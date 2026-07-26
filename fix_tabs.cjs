const fs = require('fs');
let content = fs.readFileSync('src/pages/PostinganPage.tsx', 'utf8');

content = content.replace(
  /onClick=\{\(\) => \{ setGuideTab\('aturan'\); triggerHaptic\('selection'\); \}\}.*?3\. Tips Bagus\s*<\/button>\s*<\/div>/s,
  `onClick={() => { setGuideTab('aturan'); triggerHaptic('selection'); }}
                      className={\`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 \${
                        guideTab === 'aturan'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }\`}
                    >
                      <Target className="w-3 h-3" />
                      1. Aturan Target
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGuideTab('buat'); triggerHaptic('selection'); }}
                      className={\`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 \${
                        guideTab === 'buat'
                          ? 'bg-sky-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }\`}
                    >
                      <ListOrdered className="w-3 h-3" />
                      2. Cara Buat
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGuideTab('riwayat_status'); triggerHaptic('selection'); }}
                      className={\`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all flex items-center justify-center gap-1 \${
                        guideTab === 'riwayat_status'
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }\`}
                    >
                      <History className="w-3 h-3" />
                      3. Fitur Lainya
                    </button>
                  </div>`
);

fs.writeFileSync('src/pages/PostinganPage.tsx', content, 'utf8');
