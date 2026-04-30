<?php

namespace App\Http\Controllers;

use App\Models\BillingEvent;
use App\Models\Plan;
use App\Models\Subscription as TeamSubscription;
use App\Models\Team;
use App\Services\TeamProvisioner;
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
    public function __construct(private readonly TeamProvisioner $teams)
    {
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
}
