import { Phone, Mail, MessageCircle, MapPin, Clock, Pizza, ArrowRight, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ROUTES } from '../app/routes';

export default function Contact() {
  const phone = '+33651214782';
  const phoneDisplay = '+33 6 51 21 47 82';
  const email = 'contact@planizza.com';
  const whatsappLink = `https://wa.me/33651214782?text=${encodeURIComponent('Bonjour ! Je vous contacte via PLANIZZA.')}`;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 via-transparent to-red-500/10" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6">
              <Pizza className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-bold text-orange-600">Une question ? Une idee ?</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight mb-6">
              Parlons <span className="text-gradient">Pizza</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-medium">
              PLANIZZA est une aventure humaine avant tout. N'hesitez pas a me contacter
              pour toute question, suggestion ou simplement pour echanger !
            </p>
          </div>

          {/* Contact Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {/* WhatsApp - Principal */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Card className="glass-premium glass-glossy border-emerald-500/30 p-6 rounded-3xl h-full hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/10 group-hover:bg-emerald-500/20 transition">
                    <MessageCircle className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-black text-lg">WhatsApp</h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-600 uppercase">Recommande</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Reponse rapide garantie</p>
                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm group-hover:gap-3 transition-all">
                      <span>Demarrer une conversation</span>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Card>
            </a>

            {/* Telephone */}
            <a href={`tel:${phone}`} className="group">
              <Card className="glass-premium glass-glossy border-blue-500/30 p-6 rounded-3xl h-full hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition">
                    <Phone className="h-6 w-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg mb-1">Telephone</h3>
                    <p className="text-sm text-muted-foreground mb-3">Pour un echange direct</p>
                    <div className="font-mono font-bold text-blue-600">
                      {phoneDisplay}
                    </div>
                  </div>
                </div>
              </Card>
            </a>

            {/* Email */}
            <a href={`mailto:${email}`} className="group sm:col-span-2 lg:col-span-1">
              <Card className="glass-premium glass-glossy border-purple-500/30 p-6 rounded-3xl h-full hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-purple-500/10 group-hover:bg-purple-500/20 transition">
                    <Mail className="h-6 w-6 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg mb-1">Email</h3>
                    <p className="text-sm text-muted-foreground mb-3">Pour les demandes detaillees</p>
                    <div className="font-medium text-purple-600 break-all">
                      {email}
                    </div>
                  </div>
                </div>
              </Card>
            </a>
          </div>

          {/* Founder Card */}
          <Card className="glass-premium glass-glossy border-white/20 p-8 rounded-4xl max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-orange-500/30">
                  MK
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center border-4 border-background">
                  <span className="text-sm">🍕</span>
                </div>
              </div>

              <div className="text-center sm:text-left flex-1">
                <h2 className="text-2xl font-black tracking-tight mb-1">Malik KARAOUI</h2>
                <p className="text-orange-500 font-bold mb-3">Fondateur de PLANIZZA</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Passionne de pizza et de tech, j'ai cree PLANIZZA pour connecter
                  les amoureux de la vraie pizza artisanale avec les meilleurs pizzaiolos.
                  Votre avis compte enormement pour faire evoluer la plateforme !
                </p>
              </div>
            </div>
          </Card>

          {/* Quick Actions */}
          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground mb-4 font-medium">
              Vous etes pizzaiolo ? Rejoignez l'aventure !
            </p>
            <Link to={ROUTES.becomePartner}>
              <Button className="rounded-2xl px-6 h-12 font-bold bg-orange-500 hover:bg-orange-600">
                Devenir partenaire
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* FAQ rapide */}
          <div className="mt-16">
            <h3 className="text-xl font-black text-center mb-8">Questions frequentes</h3>
            <div className="grid sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
              <Card className="glass-premium border-white/10 p-5 rounded-2xl">
                <h4 className="font-bold mb-2">Quels sont les delais de reponse ?</h4>
                <p className="text-sm text-muted-foreground">
                  Via WhatsApp : quelques heures maximum. Par email : sous 24-48h.
                </p>
              </Card>
              <Card className="glass-premium border-white/10 p-5 rounded-2xl">
                <h4 className="font-bold mb-2">Comment devenir pizzaiolo partenaire ?</h4>
                <p className="text-sm text-muted-foreground">
                  Inscrivez-vous gratuitement et creez votre profil en quelques minutes !
                </p>
              </Card>
              <Card className="glass-premium border-white/10 p-5 rounded-2xl">
                <h4 className="font-bold mb-2">PLANIZZA est-il gratuit ?</h4>
                <p className="text-sm text-muted-foreground">
                  Oui, l'utilisation est gratuite pour les clients. Une commission s'applique sur les commandes.
                </p>
              </Card>
              <Card className="glass-premium border-white/10 p-5 rounded-2xl">
                <h4 className="font-bold mb-2">Dans quelles villes etes-vous presents ?</h4>
                <p className="text-sm text-muted-foreground">
                  Nous sommes en pleine expansion ! Contactez-nous pour connaitre la couverture.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
