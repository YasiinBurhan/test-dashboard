sed -i -e '/<Archive className="w-3.5 h-3.5" \/>/!b' -e '/Arsip/!b' -e '/<\/button>/!b' -e 'a\
          {isManagement && (\
            <button\
              onClick={() => { setActiveView('"'"'status'"'"'); triggerHaptic('"'"'selection'"'"'); }}\
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${\
                activeView === '"'"'status'"'"' \
                  ? '"'"'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg'"'"' \
                  : '"'"'text-slate-600 hover:text-slate-400'"'"'\
              }`}\
            >\
              <Users className="w-3.5 h-3.5" />\
              Status\
            </button>\
          )}' src/pages/PostinganPage.tsx
