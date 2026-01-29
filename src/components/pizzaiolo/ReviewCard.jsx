import { useState } from 'react';
import { Star, MessageSquare, Send, Edit2, X } from 'lucide-react';
import { Button } from '../ui/Button';

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ReviewCard({ review, onReplySubmit, isSubmitting }) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [replyText, setReplyText] = useState(review.reply?.text || '');

  const hasReply = Boolean(review.reply);

  const handleSubmit = async () => {
    if (!replyText.trim()) return;
    await onReplySubmit(review.id, replyText);
    setIsReplying(false);
    setIsEditing(false);
  };

  return (
    <div className="glass-premium glass-glossy border-white/20 p-5 rounded-3xl space-y-3">
      {/* Header : etoiles + date + bouton repondre */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-0.5 mb-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                className={`h-4 w-4 ${s <= review.score ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/20'}`}
              />
            ))}
          </div>
          {review.customerName && (
            <p className="text-xs font-bold mb-0.5">{review.customerName}</p>
          )}
          <p className="text-xs text-muted-foreground">{formatDate(review.submittedAt)}</p>
        </div>

        {!hasReply && !isReplying && (
          <Button
            onClick={() => setIsReplying(true)}
            size="sm"
            variant="outline"
            className="rounded-2xl font-bold"
          >
            <MessageSquare className="h-3 w-3 mr-1" />
            Repondre
          </Button>
        )}
      </div>

      {/* Commentaire client */}
      {review.comment ? (
        <div className="p-3 bg-white/5 border border-white/10 rounded-2xl">
          <p className="text-sm text-muted-foreground leading-relaxed">"{review.comment}"</p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/40 italic">Aucun commentaire</p>
      )}

      {/* Reponse existante */}
      {hasReply && !isEditing && (
        <div className="pl-4 border-l-2 border-yellow-500/30 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400">Votre reponse</p>
            <Button
              onClick={() => {
                setReplyText(review.reply.text);
                setIsEditing(true);
              }}
              size="sm"
              variant="ghost"
              className="h-7 px-2"
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
          <p className="text-sm">{review.reply.text}</p>
          <p className="text-xs text-muted-foreground/60">{formatDate(review.reply.repliedAt)}</p>
        </div>
      )}

      {/* Formulaire reponse */}
      {(isReplying || isEditing) && (
        <div className="pl-4 border-l-2 border-yellow-500/30 space-y-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, 200))}
            placeholder="Ecrivez votre reponse... (200 car. max)"
            maxLength={200}
            className="w-full rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm focus:border-yellow-500/50 focus:ring-2 focus:ring-yellow-500/20 focus:outline-none transition-all placeholder:text-gray-400 min-h-[80px] resize-none"
            disabled={isSubmitting}
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !replyText.trim()}
              size="sm"
              className="rounded-2xl font-bold bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              <Send className="h-3 w-3 mr-1" />
              {isEditing ? 'Modifier' : 'Envoyer'}
            </Button>
            <Button
              onClick={() => {
                setIsReplying(false);
                setIsEditing(false);
                setReplyText(review.reply?.text || '');
              }}
              disabled={isSubmitting}
              size="sm"
              variant="outline"
              className="rounded-2xl font-bold"
            >
              <X className="h-3 w-3 mr-1" />
              Annuler
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
