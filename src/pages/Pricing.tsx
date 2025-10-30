import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Zap, Crown, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);

  const plans = [
    {
      name: "Free",
      icon: Zap,
      price: { monthly: 0, annual: 0 },
      description: "Perfect for testing and small projects",
      features: [
        "Up to 5 model evaluations/month",
        "Basic metrics (Accuracy, F1)",
        "Single user access",
        "Community support",
        "7-day data retention",
      ],
      cta: "Get Started",
      popular: false,
    },
    {
      name: "Pro",
      icon: Crown,
      price: { monthly: 49, annual: 39 },
      description: "For professional data scientists",
      features: [
        "Unlimited model evaluations",
        "Advanced metrics & visualizations",
        "Explainability & Fairness tools",
        "AutoTune hyperparameter optimization",
        "Model Registry & versioning",
        "Team collaboration (up to 5 users)",
        "Priority email support",
        "30-day data retention",
        "API access",
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      icon: Building2,
      price: { monthly: 199, annual: 159 },
      description: "For large teams and organizations",
      features: [
        "Everything in Pro",
        "Unlimited team members",
        "Custom model integrations",
        "Batch job processing",
        "Advanced security & SSO",
        "Dedicated account manager",
        "24/7 priority support",
        "Custom data retention",
        "On-premise deployment option",
        "SLA guarantee",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  const faqs = [
    {
      question: "Can I change my plan later?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal for annual subscriptions.",
    },
    {
      question: "Is there a free trial for Pro?",
      answer: "Yes! We offer a 14-day free trial for the Pro plan with no credit card required.",
    },
    {
      question: "What happens when I reach my evaluation limit?",
      answer: "On the Free plan, you'll need to upgrade to continue. Pro and Enterprise plans have unlimited evaluations.",
    },
    {
      question: "Can I cancel my subscription anytime?",
      answer: "Absolutely! You can cancel your subscription at any time from your account settings. You'll retain access until the end of your billing period.",
    },
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <h1 className="text-5xl font-bold mb-4 neon-text">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Scale your AI model evaluation with the perfect plan for your needs
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <Label htmlFor="billing" className={!isAnnual ? "text-foreground font-semibold" : "text-muted-foreground"}>
              Monthly
            </Label>
            <Switch
              id="billing"
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="data-[state=checked]:bg-primary"
            />
            <Label htmlFor="billing" className={isAnnual ? "text-foreground font-semibold" : "text-muted-foreground"}>
              Annual
            </Label>
            <Badge className="bg-accent text-accent-foreground ml-2">
              Save 20%
            </Badge>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, idx) => (
            <Card
              key={plan.name}
              className={`glass-card p-8 relative animate-fade-in-up transition-all hover:scale-105 ${
                plan.popular ? "glow-border ring-2 ring-primary/50" : ""
              }`}
              style={{ animationDelay: `${idx * 0.1}s` }}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                  Most Popular
                </Badge>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-xl ${
                  plan.popular ? "bg-primary/20" : "bg-muted/50"
                }`}>
                  <plan.icon className={`h-6 w-6 ${
                    plan.popular ? "text-primary" : "text-foreground"
                  }`} />
                </div>
                <h3 className="text-2xl font-bold">{plan.name}</h3>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {plan.description}
              </p>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold neon-text">
                    ${isAnnual ? plan.price.annual : plan.price.monthly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                {isAnnual && plan.price.annual > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Billed annually (${plan.price.annual * 12})
                  </p>
                )}
              </div>

              <Button
                className={`w-full mb-6 ${
                  plan.popular ? "btn-glow" : ""
                }`}
                variant={plan.popular ? "default" : "outline"}
              >
                {plan.cta}
              </Button>

              <div className="space-y-3">
                {plan.features.map((feature, featureIdx) => (
                  <div key={featureIdx} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <Card className="glass-card p-8 mb-16 animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-6 text-center">Feature Comparison</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-4 font-semibold">Feature</th>
                  <th className="text-center p-4 font-semibold">Free</th>
                  <th className="text-center p-4 font-semibold">Pro</th>
                  <th className="text-center p-4 font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/30">
                  <td className="p-4 text-muted-foreground">Model Evaluations</td>
                  <td className="text-center p-4">5/month</td>
                  <td className="text-center p-4">Unlimited</td>
                  <td className="text-center p-4">Unlimited</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="p-4 text-muted-foreground">Team Members</td>
                  <td className="text-center p-4">1</td>
                  <td className="text-center p-4">5</td>
                  <td className="text-center p-4">Unlimited</td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="p-4 text-muted-foreground">AutoTune</td>
                  <td className="text-center p-4"><Check className="h-4 w-4 mx-auto text-muted-foreground" /></td>
                  <td className="text-center p-4"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                  <td className="text-center p-4"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="p-4 text-muted-foreground">API Access</td>
                  <td className="text-center p-4">—</td>
                  <td className="text-center p-4"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                  <td className="text-center p-4"><Check className="h-4 w-4 mx-auto text-primary" /></td>
                </tr>
                <tr className="border-b border-border/30">
                  <td className="p-4 text-muted-foreground">Support</td>
                  <td className="text-center p-4">Community</td>
                  <td className="text-center p-4">Priority Email</td>
                  <td className="text-center p-4">24/7 Dedicated</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto animate-fade-in-up">
          <h2 className="text-2xl font-bold mb-6 text-center">Frequently Asked Questions</h2>
          
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="glass-card px-6 border-0 rounded-xl"
              >
                <AccordionTrigger className="hover:text-primary">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA */}
        <div className="mt-16 text-center animate-fade-in-up">
          <Card className="glass-card p-12 glow-border max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold mb-4">Still have questions?</h3>
            <p className="text-muted-foreground mb-6">
              Our team is here to help you choose the right plan
            </p>
            <div className="flex gap-4 justify-center">
              <Button className="btn-glow" size="lg">
                Contact Sales
              </Button>
              <Button variant="outline" size="lg">
                Schedule a Demo
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
