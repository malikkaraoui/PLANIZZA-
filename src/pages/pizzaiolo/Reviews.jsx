import { useAuth } from '../../app/providers/AuthProvider';
import { usePizzaioloTruckId } from '../../features/pizzaiolo/hooks/usePizzaioloTruckId';
import { useReviews } from '../../features/trucks/hooks/useReviews';
import { useReviewReply } from '../../features/trucks/hooks/useReviewReply';
import BackButton from '../../components/ui/BackButton';
import ReviewCard from '../../components/pizzaiolo/ReviewCard';
import { Star, MessageSquare } from 'lucide-react';

export default function PizzaioloReviews() {
  const { user } = useAuth();
  const { truckId, loading: loadingTruck } = usePizzaioloTruckId(user?.uid);
  const { reviews, loading: loadingReviews } = useReviews(truckId, 200);
  const { submitReply, isSubmitting } = useReviewReply(truckId);

  const loading = loadingTruck || loadingReviews;

  const repliedCount = reviews.filter((r) => r.reply).length;
  const avgScore =
    reviews.length > 0
      ? (reviews.reduce((sum, r) => sum + (r.score || 0), 0) / reviews.length).toFixed(1)
      : '–';

  return (
    <div className="space-y-6 pb-24">
      <BackButton to="/pro/truck" />

      {/* Header + stats */}
      <div className="glass-premium glass-glossy border-white/20 p-6 rounded-3xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-yellow-500/10">
            <MessageSquare className="h-7 w-7 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Avis clients</h1>
            <p className="text-sm text-muted-foreground">Gerez les retours de vos clients</p>
          </div>
        </div>

        {reviews.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground font-bold mb-1">Total</p>
              <p className="text-xl font-black">{reviews.length}</p>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground font-bold mb-1">Note</p>
              <div className="flex items-center justify-center gap-1">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <p className="text-xl font-black">{avgScore}</p>
              </div>
            </div>
            <div className="p-3 bg-white/5 border border-white/10 rounded-2xl text-center">
              <p className="text-xs text-muted-foreground font-bold mb-1">Reponses</p>
              <p className="text-xl font-black">
                {repliedCount}/{reviews.length}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="glass-premium glass-glossy border-white/20 p-12 rounded-3xl text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="glass-premium glass-glossy border-white/20 p-12 rounded-3xl text-center space-y-4">
          <div className="inline-flex p-5 rounded-3xl bg-yellow-500/10">
            <MessageSquare className="h-12 w-12 text-yellow-500" />
          </div>
          <h2 className="text-xl font-black">Aucun avis pour le moment</h2>
          <p className="text-muted-foreground text-sm">Les avis de vos clients apparaitront ici</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onReplySubmit={submitReply}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
