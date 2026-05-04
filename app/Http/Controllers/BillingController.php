<?php

namespace App\Http\Controllers;

use App\Models\BillingEvent;
use App\Models\Plan;
use App\Models\Subscription as TeamSubscription;
use App\Models\Team;
use App\Services\Logs\LogStorage;
use App\Services\TeamProvisioner;
use App\Support\ByteFormatter;
use App\Support\PricingCatalog;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Stripe\BillingPortal\Session as PortalSession;
use Stripe\Checkout\Session as CheckoutSession;
use Stripe\Customer;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Stripe;
use Stripe\Subscription as StripeSubscription;
use Stripe\Webhook;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class BillingController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly LogStorage $logs,
    ) {}

    public function usage(Request $request): \Inertia\Response
    {
        $team = $this->teams->defaultTeamFor($request->user())->load('plan');

        return Inertia::render('Billing/Usage', [
            'team' => $this->teamPayload($team),
            'usage' => $this->usagePayload($team),
            'plans' => Plan::query()
                ->where('is_active', true)
                ->orderBy('included_bytes')
                ->get()
                ->map(fn (Plan $plan) => PricingCatalog::planFromRecord($plan)),
        ]);
    }

    public function updateUsage(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'overage_enabled' => ['nullable', 'boolean'],
            'overage_cap_gb' => ['nullable', 'numeric', 'min:0', 'max:100000'],
        ]);

        $team = $this->teams->defaultTeamFor($request->user());
        $enabled = (bool) ($validated['overage_enabled'] ?? false);

        $team->forceFill([
            'overage_enabled' => $enabled,
            'overage_cap_bytes' => $enabled ? ByteFormatter::gbToBytes((float) ($validated['overage_cap_gb'] ?? 0)) : 0,
        ])->save();

        return back()->with('success', 'Usage guard updated.');
    }

    public function checkout(Request $request): Response|RedirectResponse
    {
        $request->validate([
            'plan' => ['required', 'string', 'exists:plans,slug'],
        ]);

        if (! $this->configured()) {
            return back()->with('success', 'Stripe is not configured yet.');
        }

        $team = $this->teams->defaultTeamFor($request->user());
        $plan = Plan::query()->where('slug', $request->input('plan'))->firstOrFail();

        if (! $plan->stripe_price_id) {
            return back()->with('success', 'This plan does not have a Stripe price ID yet.');
        }

        Stripe::setApiKey(config('fivebucket.stripe.secret'));

        if (! $team->stripe_customer_id) {
            $customer = Customer::create([
                'email' => $request->user()->email,
                'name' => $request->user()->name,
                'metadata' => ['team_id' => $team->id],
            ]);

            $team->forceFill(['stripe_customer_id' => $customer->id])->save();
        }

        $session = CheckoutSession::create([
            'mode' => 'subscription',
            'customer' => $team->stripe_customer_id,
            'line_items' => [[
                'price' => $plan->stripe_price_id,
                'quantity' => 1,
            ]],
            'allow_promotion_codes' => true,
            'success_url' => route('dashboard', [], true).'?checkout=success',
            'cancel_url' => route('dashboard', [], true).'?checkout=cancelled',
            'metadata' => [
                'team_id' => $team->id,
                'plan_id' => $plan->id,
            ],
            'subscription_data' => [
                'metadata' => [
                    'team_id' => $team->id,
                    'plan_id' => $plan->id,
                ],
            ],
        ]);

        return Inertia::location($session->url);
    }

    public function portal(Request $request): Response|RedirectResponse
    {
        if (! $this->configured()) {
            return back()->with('success', 'Stripe is not configured yet.');
        }

        $team = $this->teams->defaultTeamFor($request->user());

        if (! $team->stripe_customer_id) {
            return back()->with('success', 'No Stripe customer exists for this team yet.');
        }

        Stripe::setApiKey(config('fivebucket.stripe.secret'));

        $session = PortalSession::create([
            'customer' => $team->stripe_customer_id,
            'return_url' => route('dashboard', [], true),
        ]);

        return Inertia::location($session->url);
    }

    public function webhook(Request $request): JsonResponse
    {
        $secret = config('fivebucket.stripe.webhook_secret');

        if (! $this->configured() || ! $secret) {
            return response()->json(['message' => 'Stripe webhook is not configured.'], 500);
        }

        try {
            Stripe::setApiKey(config('fivebucket.stripe.secret'));
            $event = Webhook::constructEvent($request->getContent(), $request->header('Stripe-Signature'), $secret);

            $billingEvent = BillingEvent::firstOrCreate(
                ['stripe_event_id' => $event->id],
                [
                    'type' => $event->type,
                    'payload' => $event->toArray(),
                ]
            );

            if ($billingEvent->processed_at) {
                return response()->json(['status' => 'ok']);
            }

            match ($event->type) {
                'checkout.session.completed' => $this->handleCheckoutCompleted($event->data->object),
                'customer.subscription.created',
                'customer.subscription.updated',
                'customer.subscription.deleted' => $this->syncSubscription($event->data->object),
                default => null,
            };

            $billingEvent->forceFill(['processed_at' => now()])->save();

            return response()->json(['status' => 'ok']);
        } catch (SignatureVerificationException) {
            return response()->json(['message' => 'Invalid Stripe signature.'], 400);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'Stripe webhook failed.'], 500);
        }
    }

    private function handleCheckoutCompleted(object $session): void
    {
        $teamId = (int) ($session->metadata->team_id ?? 0);
        $team = Team::query()->find($teamId);

        if ($team && ! $team->stripe_customer_id && isset($session->customer)) {
            $team->forceFill(['stripe_customer_id' => (string) $session->customer])->save();
        }

        if (isset($session->subscription)) {
            $subscription = StripeSubscription::retrieve((string) $session->subscription);
            $this->syncSubscription($subscription);
        }
    }

    private function syncSubscription(object $subscription): void
    {
        $priceId = $subscription->items->data[0]->price->id ?? null;
        $plan = $priceId ? Plan::query()->where('stripe_price_id', $priceId)->first() : null;
        $teamId = (int) ($subscription->metadata->team_id ?? 0);
        $team = $teamId ? Team::query()->find($teamId) : null;

        if (! $team && isset($subscription->customer)) {
            $team = Team::query()->where('stripe_customer_id', (string) $subscription->customer)->first();
        }

        if (! $team) {
            return;
        }

        TeamSubscription::updateOrCreate(
            ['stripe_subscription_id' => (string) $subscription->id],
            [
                'team_id' => $team->id,
                'plan_id' => $plan?->id,
                'stripe_price_id' => $priceId,
                'status' => (string) $subscription->status,
                'current_period_start' => $this->timestamp($subscription->current_period_start ?? null),
                'current_period_end' => $this->timestamp($subscription->current_period_end ?? null),
                'cancel_at' => $this->timestamp($subscription->cancel_at ?? null),
                'canceled_at' => $this->timestamp($subscription->canceled_at ?? null),
            ]
        );

        if ($plan && in_array($subscription->status, ['active', 'trialing'], true)) {
            $team->forceFill([
                'plan_id' => $plan->id,
                'storage_limit_bytes' => $plan->included_bytes,
                'billing_status' => $subscription->status,
            ])->save();
        }
    }

    private function timestamp(mixed $value): ?CarbonImmutable
    {
        return $value ? CarbonImmutable::createFromTimestamp((int) $value) : null;
    }

    private function configured(): bool
    {
        return filled(config('fivebucket.stripe.secret'));
    }

    private function teamPayload(Team $team): array
    {
        $plan = $team->plan ? PricingCatalog::planFromRecord($team->plan) : null;

        return [
            'id' => $team->id,
            'name' => $team->name,
            'slug' => $team->slug,
            'billingStatus' => $team->billing_status,
            'plan' => $plan ? [
                'name' => $plan['name'],
                'slug' => $plan['slug'],
                'included' => $plan['included'],
                'monthly' => $plan['monthly'],
                'overage' => $plan['overage'],
            ] : null,
            'storageUsed' => ByteFormatter::human($team->storage_used_bytes),
            'storageLimit' => ByteFormatter::human($team->storage_limit_bytes),
            'effectiveStorageLimit' => ByteFormatter::human($team->effectiveStorageLimitBytes()),
            'storageUsedBytes' => $team->storage_used_bytes,
            'storageLimitBytes' => $team->storage_limit_bytes,
            'effectiveStorageLimitBytes' => $team->effectiveStorageLimitBytes(),
            'overageEnabled' => (bool) $team->overage_enabled,
            'overageCapGb' => ByteFormatter::bytesToGb((int) $team->overage_cap_bytes),
        ];
    }

    private function usagePayload(Team $team): array
    {
        $periodStart = now()->startOfMonth();
        $periodEnd = now()->endOfMonth();
        $usageQuery = $team->usageRecords()->where('created_at', '>=', $periodStart);
        $bandwidthBytes = (int) (clone $usageQuery)->where('metric', 'bandwidth_bytes')->sum('delta');
        $deduplicatedBytes = (int) (clone $usageQuery)->where('metric', 'deduplicated_bytes')->sum('delta');
        $logsIngested = (int) (clone $usageQuery)->where('metric', 'logs_ingested')->sum('delta');

        try {
            $logsIngested = max($logsIngested, $this->logs->count($team, [
                'from' => $periodStart->toIso8601String(),
                'to' => now()->toIso8601String(),
            ]));
        } catch (Throwable $exception) {
            report($exception);
        }

        $billableOverageBytes = $team->billableOverageBytes();
        $billableOverageGb = $billableOverageBytes > 0 ? (int) ceil($billableOverageBytes / 1024 / 1024 / 1024) : 0;
        $overagePriceCents = (int) ($team->plan?->overage_price_cents_per_gb ?? config('fivebucket.default_overage_price_cents_per_gb'));
        $estimatedOverageCents = $billableOverageGb * $overagePriceCents;
        $monthlyBaseCents = (int) ($team->plan?->monthly_price_cents ?? 0);

        return [
            'period' => [
                'label' => $periodStart->format('M d').' - '.$periodEnd->format('M d, Y'),
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
            ],
            'storagePercent' => round(($team->storage_used_bytes / max(1, $team->effectiveStorageLimitBytes())) * 100, 1),
            'baseStoragePercent' => round(($team->storage_used_bytes / max(1, $team->storage_limit_bytes)) * 100, 1),
            'billableOverageBytes' => $billableOverageBytes,
            'billableOverage' => ByteFormatter::human($billableOverageBytes),
            'billableOverageGb' => $billableOverageGb,
            'overagePrice' => $this->money($overagePriceCents).'/Go',
            'monthlyBase' => $this->money($monthlyBaseCents),
            'estimatedOverage' => $this->money($estimatedOverageCents),
            'estimatedTotal' => $this->money($monthlyBaseCents + $estimatedOverageCents),
            'logsIngested' => $logsIngested,
            'bandwidth' => ByteFormatter::human(max(0, $bandwidthBytes)),
            'bandwidthBytes' => max(0, $bandwidthBytes),
            'deduplicated' => ByteFormatter::human(max(0, $deduplicatedBytes)),
            'deduplicatedBytes' => max(0, $deduplicatedBytes),
        ];
    }

    private function money(int $cents): string
    {
        return PricingCatalog::money($cents);
    }
}
