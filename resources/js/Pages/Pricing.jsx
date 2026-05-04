import ApplicationLogo from '@/Components/ApplicationLogo';
import { PageHeader } from '@/Components/Design';
import ThemeToggle from '@/Components/ThemeToggle';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { ArrowRight, CheckCircle2, Gauge, HardDrive, ReceiptText, ScrollText, ShieldCheck } from 'lucide-react';

export default function Pricing({ auth = { user: null }, plans = [], extras = [] }) {
    const content = (
        <div className="fb-page fb-pricing-page">
            <PageHeader
                eyebrow="FiveBucket"
                title="Tarifs"
                description="Des limites simples pour stocker vos médias, consulter vos logs et garder le contrôle sur les dépassements."
                actions={auth.user ? (
                    <Button asChild variant="secondary" size="sm">
                        <Link href={route('billing.usage')}>
                            <ReceiptText className="h-3.5 w-3.5" />
                            Usage actuel
                        </Link>
                    </Button>
                ) : (
                    <Button asChild size="sm">
                        <Link href={route('register')}>
                            Créer un compte
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                )}
            />

            <div className="fb-pricing-grid">
                {plans.map((plan) => (
                    <PlanCard key={plan.slug} plan={plan} authenticated={Boolean(auth.user)} />
                ))}
            </div>

            <div className="fb-pricing-support">
                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle>Consommation additionnelle</CardTitle>
                            <p className="fb-panel-subtitle">Activez un plafond de dépassement depuis Billing pour éviter les surprises.</p>
                        </div>
                        <ShieldCheck className="h-4 w-4 fb-dim" />
                    </CardHeader>
                    <CardContent>
                        <div className="fb-pricing-extra-grid">
                            {extras.map((extra) => (
                                <div key={extra.label} className="fb-pricing-extra">
                                    <span>{extra.label}</span>
                                    <strong>{extra.price}</strong>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="fb-pricing-note">
                    <div className="fb-pricing-note-icon">
                        <Gauge className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="text-[12px] font-semibold text-[var(--fg)]">Dépassements maîtrisés</div>
                        <p>
                            Vous pouvez bloquer les uploads une fois la limite atteinte, ou définir un plafond payant en Go pour absorber les pics temporaires.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    if (auth.user) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <Head title="Pricing" />
                {content}
            </AuthenticatedLayout>
        );
    }

    return (
        <div className="fb-landing fb-pricing-public">
            <Head title="Pricing" />
            <nav className="fb-landing-nav">
                <Link href="/" className="text-decoration-none">
                    <ApplicationLogo />
                </Link>
                <div className="fb-page-actions">
                    <Button asChild variant="ghost" size="sm">
                        <Link href={route('docs')}>Docs</Link>
                    </Button>
                    <Button asChild variant="secondary" size="sm">
                        <Link href={route('login')}>Connexion</Link>
                    </Button>
                    <ThemeToggle />
                </div>
            </nav>
            {content}
        </div>
    );
}

function PlanCard({ plan, authenticated }) {
    return (
        <article className={`fb-pricing-card ${plan.highlighted ? 'featured' : ''}`}>
            <div className="fb-pricing-card-head">
                <div>
                    <h2>{plan.name}</h2>
                    <p>{plan.description}</p>
                </div>
                {plan.highlighted && <Badge variant="green">Populaire</Badge>}
            </div>

            <div className="fb-pricing-price">{plan.price}</div>

            <ul className="fb-pricing-list">
                {plan.features.map((feature) => (
                    <li key={feature}>
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="fb-pricing-card-foot">
                <div className="fb-pricing-quota">
                    <HardDrive className="h-3.5 w-3.5" />
                    <span>{plan.included}</span>
                </div>
                <div className="fb-pricing-quota">
                    <ScrollText className="h-3.5 w-3.5" />
                    <span>{plan.features.find((feature) => feature.startsWith('Logs')) ?? 'Logs inclus'}</span>
                </div>
            </div>

            <PlanAction plan={plan} authenticated={authenticated} />
        </article>
    );
}

function PlanAction({ plan, authenticated }) {
    if (! authenticated) {
        return (
            <Button asChild className="w-full" variant={plan.highlighted ? 'default' : 'secondary'}>
                <Link href={route('register')}>
                    Commencer
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </Button>
        );
    }

    if (plan.isFree) {
        return (
            <Button asChild className="w-full" variant="secondary">
                <Link href={route('dashboard')}>Plan actuel ou essai gratuit</Link>
            </Button>
        );
    }

    if (! plan.checkoutReady) {
        return (
            <Button type="button" className="w-full" variant="secondary" disabled>
                Paiement bientôt disponible
            </Button>
        );
    }

    return (
        <Button asChild className="w-full" variant={plan.highlighted ? 'default' : 'secondary'}>
            <Link href={route('billing.checkout')} method="post" as="button" data={{ plan: plan.slug }}>
                Choisir {plan.name}
                <ArrowRight className="h-4 w-4" />
            </Link>
        </Button>
    );
}
