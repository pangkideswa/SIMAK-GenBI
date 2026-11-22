import React, { useRef } from 'react';
import { X, Printer, Users, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateTimeWIB } from '../lib/dateUtils';
import { sanitizeMemberIdentity } from '../lib/attendanceSync';

export interface AttendanceSheetParticipant {
  id: string;
  npm: string;
  nim?: string;
  full_name: string;
  division: string;
  scanned_at: string;
  status: 'hadir' | 'izin' | 'pending';
  verified?: boolean;
}

interface AttendanceSheetModalProps {
  event: {
    id: string;
    title: string;
    category: string;
    event_date: string;
    points: number;
    qr_token?: string;
    location?: string;
  };
  participants: AttendanceSheetParticipant[];
  onClose: () => void;
}

export const AttendanceSheetModal: React.FC<AttendanceSheetModalProps> = ({
  event,
  participants,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const presentCount = participants.filter((p) => p.status === 'hadir').length;
  const permissionCount = participants.filter((p) => p.status === 'izin').length;

  const eventDateFormatted = new Date(event.event_date).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const printDateFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const verifyDocUrl = `${window.location.origin}?verify=agenda&token=${encodeURIComponent(
    event.qr_token || event.id
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200 print:shadow-none print:border-none print:m-0 print:w-full print:rounded-none">
        {/* Header Action Bar (Hidden on Print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-black tracking-wide uppercase">
              Cetak Berita Acara & Daftar Hadir Presensi Fisik
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printRef} className="p-8 sm:p-10 text-slate-800 space-y-6 print:p-6 bg-white font-sans text-xs">
          {/* Formal Kop Surat Bank Indonesia & GenBI UNMA (Selaras dengan Rapor Keaktifan) */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shrink-0 p-1 border border-slate-200">
              <img
                src="/logo-BI.png"
                alt="Logo Bank Indonesia"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="text-center flex-1 space-y-0.5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600">
                KANTOR PERWAKILAN BANK INDONESIA CIREBON
              </h2>
              <h1 className="text-base sm:text-lg font-black uppercase text-slate-950 tracking-tight">
                KOMUNITAS GENERASI BARU INDONESIA (GenBI)
              </h1>
              <p className="text-xs font-bold text-slate-800">
                KOMISARIAT UNIVERSITAS MAJALENGKA (UNMA)
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Sekretariat: Jl. Raya K.H. Abdul Halim No. 103, Majalengka 45418 &bull; Email: genbiunma.official@gmail.com
              </p>
            </div>

            <div className="w-16 h-16 rounded-xl bg-white flex items-center justify-center shrink-0 p-1 border border-slate-200">
              <img
                src="/logo-genbi.png"
                alt="Logo GenBI UNMA"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Judul Dokumen */}
          <div className="text-center space-y-1">
            <h3 className="text-sm font-black tracking-widest uppercase text-slate-900 underline underline-offset-4">
              BERITA ACARA &amp; DAFTAR HADIR KEGIATAN
            </h3>
            <p className="text-[10px] font-mono text-slate-500">
              NOMOR REGISTRASI: BA-SIMAK/{event.id.toUpperCase().slice(0, 8)}/{new Date().getFullYear()}
            </p>
          </div>

          {/* Rincian Kegiatan */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Nama Agenda / Kegiatan</span>
              <span className="font-extrabold text-slate-900">{event.title}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Waktu Pelaksanaan</span>
              <span className="font-bold text-slate-800">{eventDateFormatted}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Kategori &amp; Bobot</span>
              <span className="font-bold text-blue-700">{event.category.toUpperCase()} (+{event.points} Poin)</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Total Partisipasi</span>
              <span className="font-bold text-slate-900">{presentCount} Hadir &bull; {permissionCount} Izin</span>
            </div>
          </div>

          {/* Tabel Presensi Peserta */}
          <div className="border border-slate-300 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead className="bg-slate-100 text-slate-800 font-black uppercase tracking-wider border-b border-slate-300">
                <tr>
                  <th className="py-2 px-2.5 text-center w-8 border-r border-slate-300">No</th>
                  <th className="py-2 px-3 border-r border-slate-300">NPM</th>
                  <th className="py-2 px-3 border-r border-slate-300">Nama Lengkap Anggota</th>
                  <th className="py-2 px-3 border-r border-slate-300">Divisi Organisasi</th>
                  <th className="py-2 px-2.5 text-center border-r border-slate-300">Waktu Presensi (WIB)</th>
                  <th className="py-2 px-2.5 text-center border-r border-slate-300">Status</th>
                  <th className="py-2 px-3 text-center w-28">Verifikasi / TTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {participants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-400 italic">
                      Tidak ada data presensi yang tercatat pada kegiatan ini.
                    </td>
                  </tr>
                ) : (
                  participants.map((p, index) => {
                    const safeP = sanitizeMemberIdentity(p);
                    return (
                      <tr key={p.id} className={index % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}>
                        <td className="py-1.5 px-2 text-center font-bold text-slate-500 border-r border-slate-200">
                          {index + 1}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-bold text-slate-800 border-r border-slate-200">
                          {safeP.npm || safeP.nim}
                        </td>
                        <td className="py-1.5 px-3 font-bold text-slate-900 border-r border-slate-200">
                          {safeP.full_name}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 border-r border-slate-200">
                          {safeP.division}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[9px] text-slate-600 border-r border-slate-200">
                          {formatDateTimeWIB(safeP.scanned_at)}
                        </td>
                        <td className="py-1.5 px-2 text-center border-r border-slate-200">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black text-[9px] uppercase ${
                              safeP.status === 'hadir'
                                ? 'bg-emerald-100 text-emerald-900'
                                : 'bg-blue-100 text-blue-900'
                            }`}
                          >
                            {safeP.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-center text-[9px] font-mono text-slate-400">
                          <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 inline" />
                            <span>VALID DIGITAL</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Tanda Tangan Pengesahan BPH */}
          <div className="pt-4 flex items-end justify-between text-[11px]">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-mono block">VERIFIKASI INTEGRITAS DOKUMEN:</span>
              <div className="flex items-center gap-2">
                <QRCodeSVG value={verifyDocUrl} size={54} level="M" />
                <div className="text-[8px] text-slate-500 font-mono leading-tight">
                  <p className="font-bold text-slate-700">SIMAK GENBI V1.0</p>
                  <p>Keaslian berkas tercatat</p>
                  <p>secara elektronik di sistem</p>
                </div>
              </div>
            </div>

            <div className="text-right space-y-1">
              <p className="text-slate-600">Majalengka, {printDateFormatted}</p>
              <p className="font-bold text-slate-800">Badan Pengurus Harian (BPH)</p>
              <p className="text-[10px] text-slate-500">Komisariat Universitas Majalengka</p>
              <div className="h-14" />
              <div className="border-t border-slate-400 pt-1 font-bold text-slate-900 inline-block min-w-[180px] text-center">
                PENGURUS HARIAN RESMI
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendanceSheetModal;
