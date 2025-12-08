import React from 'react';
import { Player, Mission } from '../types';
import { Trophy, Wine, ClipboardList, RotateCcw, User } from 'lucide-react';

interface SummaryPhaseProps {
  players: Player[];
  groomCorrectCount: number;
  totalQuestions: number;
  onRestart: () => void;
}

const SummaryPhase: React.FC<SummaryPhaseProps> = ({ players, groomCorrectCount, totalQuestions, onRestart }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];

  // Calculate groom score percentage
  const groomPercentage = Math.round((groomCorrectCount / totalQuestions) * 100);

  return (
    <div className="max-w-4xl mx-auto text-center space-y-10 pb-12 animate-fade-in">
      
      <div className="space-y-4">
        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
          סיכום המשחק
        </h1>
        <p className="text-2xl text-slate-300">הערב רק מתחיל...</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Groom Stats */}
        <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 shadow-xl">
          <h2 className="text-2xl font-bold text-white mb-6">ביצועי החתן</h2>
          <div className="relative inline-block">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                className="text-slate-700"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
                r="70"
                cx="80"
                cy="80"
              />
              <circle
                className={`${groomPercentage > 50 ? 'text-green-500' : 'text-red-500'} transition-all duration-1000 ease-out`}
                strokeWidth="12"
                strokeDasharray={440}
                strokeDashoffset={440 - (440 * groomPercentage) / 100}
                strokeLinecap="round"
                stroke="currentColor"
                fill="transparent"
                r="70"
                cx="80"
                cy="80"
              />
            </svg>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl font-bold text-white">
              {groomCorrectCount}/{totalQuestions}
            </div>
          </div>
          <p className="mt-4 text-slate-400">
            {groomPercentage > 70 ? "הוא מכיר אותה מצוין!" : "יש לו עוד מה ללמוד..."}
          </p>
        </div>

        {/* Winner */}
        {winner && (
          <div className="bg-gradient-to-br from-purple-900 to-slate-900 p-8 rounded-3xl border border-purple-500/30 shadow-xl relative overflow-hidden flex flex-col items-center">
             <div className="absolute top-0 right-0 p-4 opacity-20">
               <Trophy className="w-32 h-32 text-yellow-500" />
             </div>
             <h2 className="text-2xl font-bold text-yellow-400 mb-4">האלוף של הערב</h2>
             
             {/* Winner Photo */}
             <div className="w-32 h-32 rounded-full border-4 border-yellow-400 overflow-hidden mb-4 shadow-lg bg-slate-800">
                {winner.photo ? (
                    <img src={winner.photo} className="w-full h-full object-cover" alt="Winner" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <User className="w-16 h-16 text-yellow-200" />
                    </div>
                )}
             </div>

             <div className="text-4xl font-black text-white mb-2">{winner.name}</div>
             <p className="text-purple-300 text-xl font-medium">עם {winner.score} נקודות</p>
             <div className="mt-6 flex items-center justify-center gap-2 text-slate-400 bg-black/20 p-2 rounded-lg inline-flex">
                <Wine className="w-5 h-5" />
                <span>שתה רק {winner.drinks} צ'ייסרים</span>
             </div>
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-blue-400" />
          <h3 className="text-xl font-bold text-white">טבלת תוצאות</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-900/50 text-slate-400 text-sm uppercase">
              <tr>
                <th className="px-6 py-4">משתתף</th>
                <th className="px-6 py-4">נקודות</th>
                <th className="px-6 py-4">צ'ייסרים</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {sortedPlayers.map((p, i) => (
                <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-white flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-600'}`}>
                      {i + 1}
                    </span>
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-700 shrink-0">
                       {p.photo ? (
                           <img src={p.photo} alt="" className="w-full h-full object-cover" />
                       ) : (
                           <div className="w-full h-full flex items-center justify-center text-slate-400">
                               <User className="w-4 h-4" />
                           </div>
                       )}
                   </div>
                    {p.name}
                  </td>
                  <td className="px-6 py-4 text-blue-300 font-bold">{p.score}</td>
                  <td className="px-6 py-4 text-red-300 font-bold">{p.drinks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button 
        onClick={onRestart}
        className="flex items-center justify-center gap-2 mx-auto text-slate-400 hover:text-white transition-colors py-4"
      >
        <RotateCcw className="w-5 h-5" />
        <span>התחל מחדש</span>
      </button>

    </div>
  );
};

export default SummaryPhase;