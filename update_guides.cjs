const fs = require('fs');
let content = fs.readFileSync('src/pages/PostinganPage.tsx', 'utf8');

const regex = /\{\/\* Tab Content: Aturan Target \*\/\}.*?\{\/\* Tab Content: Tips Postingan Bagus \*\/\}.*?<\/ul>\s*<\/div>\s*\)\}\s*<\/div>\s*\)\}/s;

const replacement = `{/* Tab Content: Aturan Target */}
                  {guideTab === 'aturan' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-2 text-[11px] text-slate-700 dark:text-slate-300 leading-relaxed">
                      <div className="flex items-start gap-2 text-sky-600 dark:text-sky-300 font-bold">
                        <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                        <span>Ketentuan Beban Target Postingan Harian:</span>
                      </div>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">
                        Sistem secara otomatis menghitung rekrutan hari ini dari menu <strong className="text-slate-900 dark:text-white">Data Harian</strong> untuk menentukan kuota postingan minimal yang wajib dipenuhi:
                      </p>
                      <ul className="space-y-1.5 pl-1 text-[10px]">
                        <li className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-rose-200 dark:border-rose-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">0 Rekrutan Hari Ini:</strong> Wajib minimal <strong className="text-rose-600 dark:text-rose-400">90 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-amber-200 dark:border-amber-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">1 Rekrutan Hari Ini:</strong> Kuota berkurang menjadi minimal <strong className="text-amber-600 dark:text-amber-400">60 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-sky-200 dark:border-sky-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">2 Rekrutan Hari Ini:</strong> Kuota berkurang menjadi minimal <strong className="text-sky-600 dark:text-sky-400">30 link postingan</strong>.</span>
                        </li>
                        <li className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 text-slate-700 dark:text-slate-300 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span><strong className="text-slate-900 dark:text-white">3+ Rekrutan Hari Ini:</strong> Bebas! Target tercapai 100% dan tidak wajib posting link.</span>
                        </li>
                      </ul>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[9.5px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span>⏰ Batas Pengiriman: <strong className="text-slate-900 dark:text-white">22:00 WIB</strong></span>
                        <span>🔄 Reset sistem: <strong className="text-slate-900 dark:text-white">00:00 WIB</strong></span>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Cara Buat Postingan */}
                  {guideTab === 'buat' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-2.5 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2 text-sky-600 dark:text-sky-300 font-bold">
                        <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Cara Pengisian Form Postingan:</span>
                      </div>
                      <ol className="space-y-2 text-[10px] text-slate-700 dark:text-slate-300">
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold flex items-center justify-center shrink-0 text-[9px]">1</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white">Nomor Awal:</strong> Dihitung otomatis dari postingan sebelumnya. Jika Anda perlu mengubahnya, ketik nomor yang diinginkan (hanya disarankan jika ada kesalahan perhitungan otomatis).
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold flex items-center justify-center shrink-0 text-[9px]">2</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white">Pilih Grup Telegram:</strong> Pilih grup tujuan untuk mengirimkan laporan (misalnya: Grup Laporan).
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold flex items-center justify-center shrink-0 text-[9px]">3</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white">Input Platform & Link:</strong> Pilih media sosial (Facebook, TikTok, Instagram, dll) dan tempelkan URL dari postingan Anda. Gunakan tombol <em className="text-sky-600 dark:text-sky-400">+ Tambah Link</em> jika ingin mengirim beberapa link sekaligus. 
                            <br/><span className="text-rose-600 dark:text-rose-400 mt-1 block">Catatan: Jangan gunakan link duplikat, sistem akan menolaknya.</span>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="w-4 h-4 rounded-full bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold flex items-center justify-center shrink-0 text-[9px]">4</span>
                          <div>
                            <strong className="text-slate-900 dark:text-white">Kirim ke Telegram:</strong> Tekan tombol kirim. Laporan akan otomatis dikirimkan ke grup yang dipilih dan tersimpan ke menu Riwayat.
                          </div>
                        </li>
                      </ol>
                    </div>
                  )}

                  {/* Tab Content: Riwayat & Status */}
                  {guideTab === 'riwayat_status' && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/60 space-y-2 text-[11px] text-slate-700 dark:text-slate-300">
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold">
                        <History className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Panduan Menu Riwayat & Status:</span>
                      </div>
                      <ul className="space-y-1.5 text-[10px] text-slate-700 dark:text-slate-300">
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span><strong className="text-slate-900 dark:text-white">Menu Riwayat:</strong> Digunakan untuk melihat semua postingan yang telah Anda kirim, yang dipisahkan per hari dalam seminggu. Anda juga dapat melihat postingan pada minggu-minggu sebelumnya melalui sub-menu "Arsip".</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span><strong className="text-slate-900 dark:text-white">Postingan Anda Sendiri:</strong> Anda hanya dapat melihat postingan Anda. Admin & Owner memiliki akses untuk melihat riwayat postingan semua anggota tim dari menu Dropdown "Pilih Recruiter".</span>
                        </li>
                        {isManagement && (
                        <li className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span><strong className="text-slate-900 dark:text-white">Menu Status Tim (Hanya Manajemen):</strong> Memungkinkan Admin & Owner untuk melihat keseluruhan status capaian tim hari ini. Memudahkan Anda melacak siapa yang belum atau sudah memenuhi target jumlah postingan hariannya.</span>
                        </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/pages/PostinganPage.tsx', content, 'utf8');
