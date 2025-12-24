import { Link } from 'react-router-dom';
import { Star, Truck } from 'lucide-react';
import { useRecommendedTrucks } from './hooks/useRecommendedTrucks';
import { Skeleton } from '../../components/ui/skeleton';

export default function RecommendedTrucks() {
    const { recommended, loading } = useRecommendedTrucks();

    if (loading) {
        return (
            <div className="flex justify-center gap-6 py-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="w-56 h-72 rounded-3xl glass-premium animate-pulse flex flex-col p-4">
                        <div className="w-full aspect-video rounded-2xl bg-white/5 mb-4" />
                        <div className="h-4 w-3/4 bg-white/5 rounded mx-auto mb-2" />
                        <div className="h-4 w-1/2 bg-white/5 rounded mx-auto mt-auto" />
                    </div>
                ))}
            </div>
        );
    }

    if (!recommended.length) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center gap-4 py-2 opacity-50">
                <div className="h-px w-12 bg-white/10" />
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                    Sélectionnés pour vous
                </span>
                <div className="h-px w-12 bg-white/10" />
            </div>

            <div className="flex flex-wrap justify-center gap-6 md:gap-8 px-4">
                {recommended.map((truck) => (
                    <div
                        key={truck.id}
                        className="group relative w-56 glass-premium glass-glossy rounded-[32px] p-4 transition-all duration-500 hover:scale-105 hover:-translate-y-2 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] border-white/20"
                    >
                        {/* Photo */}
                        <div className="relative aspect-square overflow-hidden rounded-2xl mb-5 shadow-inner">
                            {/* Tag Type Recommendation */}
                            <div className="absolute top-3 right-3 z-20">
                                <span className="px-3 py-1.5 bg-white/90 backdrop-blur-md border border-white/20 rounded-full text-[8px] font-black text-gray-900 uppercase tracking-widest shadow-xl">
                                    {truck.recType === 'history' ? 'Déjà goûté' : truck.recType === 'distance' ? 'À côté' : 'Top Planizza'}
                                </span>
                            </div>

                            <img
                                src={truck.photos?.[0] || '/images/trucks/placeholder.png'}
                                alt={truck.name}
                                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        </div>

                        {/* Info */}
                        <div className="text-center space-y-3">
                            <h3 className="text-sm font-black tracking-tight text-foreground truncate px-1">
                                {truck.name}
                            </h3>

                            <div className="flex items-center justify-center gap-1.5 text-orange-400">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs font-black">{truck.ratingAvg}</span>
                                <span className="text-[10px] text-muted-foreground/60 font-bold">({truck.ratingCount})</span>
                            </div>

                            <Link
                                to={`/truck/${truck.id}`}
                                className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xs"
                            >
                                <Truck className="h-3 w-3" />
                                Commander
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
