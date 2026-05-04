import { EmptyState, KpiCard, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Progress } from '@/Components/ui/progress';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { BarChart3, Database, HardDrive, ReceiptText, ShieldCheck, Signal, Wallet } from 'lucide-react';

export default function BillingUsage({ auth, team, usage, plans }) {
    const { flash } = usePage().props;
    const overageForm = useForm({
        overage_enabled: team.overageEnabled,
        overage_cap_gb: team.overageCapGb || 0,
    });

    const submitOverage = (event) => {
        event.preventDefault();
        overageForm.patch(route('billing.usage.update'), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Billing Usage" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Billing Usage"
                    description="Track storage, logs, delivery usage, deduplicated uploads, and cap your paid overage."
                    actions={(
                        <>
                            <Badge variant={team.overageEnabled ? 'green' : 'amber'}>{team.overageEnabled ? 'Overage enabled' : 'Hard cap'}</Badge>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('billing.portal')} method="post" as="button">
                                    <Wallet className="h-3.5 w-3.5" />
                                    Billing portal
                                </Link>
                            </Button>
                        </>
                    )}
                />

                {flash.success && <div className="fb-alert success mb-3">{flash.success}</div>}

                <div className="fb-kpis">
                    <KpiCard icon={HardDrive} label="Storage" value={team.storageUsed} detail={`${team.effectiveStorageLimit} effective cap`} />
                    <KpiCard icon={Database} label="Logs this month" value={usage.logsIngested} detail={usage.period.label} tone="muted" />
                    <KpiCard icon={Signal} label="Delivery" value={usage.bandwidth} detail="estimated delivered traffic" tone="muted" />
                    <KpiCard icon={ReceiptText} label="Estimated total" value={usage.estimatedTotal} detail={`${usage.monthlyBase} base · ${usage.estimatedOverage} overage`} />
                </div>

                <div className="fb-grid fb-billing-layout">
                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Usage Forecast</CardTitle>
                                <p className="fb-panel-subtitle">Current month estimate. Storage overage is capped by your guard settings.</p>
                            </div>
                            <Badge>{usage.period.label}</Badge>
                        </CardHeader>
                        <CardContent className="fb-stack">
                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="text-[12px] font-semibold text-[var(--fg)]">Effective storage cap</span>
                                    <span className="fb-mono text-[11px] fb-dim">{usage.storagePercent}%</span>
                                </div>
                                <Progress value={Math.min(100, usage.storagePercent)} />
                                <div className="mt-2 fb-mono text-[11px] fb-muted">{team.storageUsed} used · {team.storageLimit} included · {team.effectiveStorageLimit} effective</div>
                            </div>

                            <div className="fb-billing-meter">
                                <Metric label="Billable overage" value={usage.billableOverage} detail={`${usage.billableOverageGb} Go facturables · ${usage.overagePrice}`} />
                                <Metric label="Deduplicated uploads" value={usage.deduplicated} detail="storage avoided by duplicate detection" />
                                <Metric label="Estimated delivery" value={usage.bandwidth} detail="downloads delivered by FiveBucket URLs" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Overage Guard</CardTitle>
                            <ShieldCheck className="h-4 w-4 fb-dim" />
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={submitOverage} className="fb-stack">
                                <label className="flex items-center gap-2 text-[12px] fb-muted">
                                    <input
                                        type="checkbox"
                                        checked={overageForm.data.overage_enabled}
                                        onChange={(event) => overageForm.setData('overage_enabled', event.target.checked)}
                                        className="rounded border-[var(--border)] bg-[var(--bg)] text-emerald-500"
                                    />
                                    Allow paid storage overage
                                </label>

                                <label className="fb-label">
                                    Overage cap in GB
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.1"
                                        className="fb-input mt-1"
                                        value={overageForm.data.overage_cap_gb}
                                        disabled={!overageForm.data.overage_enabled}
                                        onChange={(event) => overageForm.setData('overage_cap_gb', event.target.value)}
                                    />
                                    <span className="fb-help">Keep this at 0 to block uploads once included storage is full.</span>
                                    {overageForm.errors.overage_cap_gb && <span className="fb-error-text">{overageForm.errors.overage_cap_gb}</span>}
                                </label>

                                <Button type="submit" disabled={overageForm.processing}>
                                    <ShieldCheck className="h-4 w-4" />
                                    Save guard
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle>Plans</CardTitle>
                            <p className="fb-panel-subtitle">Upgrade included usage, then use the overage guard to control paid growth.</p>
                        </div>
                        <BarChart3 className="h-4 w-4 fb-dim" />
                    </CardHeader>
                    <CardContent>
                        {plans.length === 0 ? (
                            <EmptyState>No active plans configured.</EmptyState>
                        ) : (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Plan</th>
                                            <th>Included usage</th>
                                            <th>Base</th>
                                            <th>Extra storage</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {plans.map((plan) => (
                                            <tr key={plan.slug}>
                                                <td>
                                                    <div className="font-medium text-[var(--fg)]">{plan.name}</div>
                                                    <div className="text-[11px] fb-dim">{plan.description}</div>
                                                </td>
                                                <td>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {plan.features.slice(0, 3).map((feature) => (
                                                            <Badge key={feature}>{feature}</Badge>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="fb-mono">{plan.monthly}</td>
                                                <td className="fb-mono">{plan.overage}</td>
                                                <td>
                                                    {plan.isFree ? (
                                                        <Button asChild variant="secondary" size="sm">
                                                            <Link href={route('dashboard')}>
                                                                Current
                                                            </Link>
                                                        </Button>
                                                    ) : plan.checkoutReady ? (
                                                        <Button asChild variant="secondary" size="sm">
                                                            <Link href={route('billing.checkout')} method="post" as="button" data={{ plan: plan.slug }}>
                                                                Select
                                                            </Link>
                                                        </Button>
                                                    ) : (
                                                        <Button type="button" variant="secondary" size="sm" disabled>
                                                            Soon
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({ label, value, detail }) {
    return (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.06em] fb-dim">{label}</div>
            <div className="mt-2 fb-mono text-[18px] font-semibold text-[var(--fg)]">{value}</div>
            <div className="mt-1 text-[11px] fb-muted">{detail}</div>
        </div>
    );
}
