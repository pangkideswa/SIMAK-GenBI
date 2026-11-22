import React, { useRef } from 'react';
import { X, Printer, ShieldCheck, Award, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatDateLongIndo } from '../lib/dateUtils';
import type { MemberEvaluation } from '../types/database';

interface MemberReportModalProps {
  evaluation: MemberEvaluation;
  onClose: () => void;
}

export const MemberReportModal: React.FC<MemberReportModalProps> = ({
  evaluation,
  onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const studentId = evaluation.npm || evaluation.nim || '-';
  const roleName =
    (evaluation as any).jabatan ||
    (evaluation.role === 'admin'
      ? 'BPH / Pengurus Harian'
      : evaluation.role === 'kadiv'
      ? 'Kepala Divisi'
      : 'Anggota Aktif');

  const isRecommended =
    evaluation.predicate === 'Sangat Aktif' || evaluation.total_points >= 60;

  const recommendationText =
    evaluation.total_points >= 80
      ? 'SANGAT DIREKOMENDASIKAN UNTUK PERPANJANGAN BEASISWA BANK INDONESIA (PREDIKAT SANGAT AKTIF)'
      : evaluation.total_points >= 60
      ? 'DIREKOMENDASIKAN UNTUK PERPANJANGAN BEASISWA BANK INDONESIA'
      : 'PERLU PEMBINAAN & EVALUASI KHUSUS DARI PENGURUS BPH & PEMBINA';

  const verificationUrl = `${window.location.origin}?verify=doc&npm=${encodeURIComponent(
    studentId
  )}&date=${new Date().toISOString().split('T')[0]}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white">
      {/* Printable Area Wrapper */}
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-200 print:shadow-none print:border-none print:m-0 print:w-full print:rounded-none">
        {/* Header Action Bar (Hidden on Print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-black tracking-wide uppercase">
              Rapor Keaktifan & Rekomendasi Beasiswa Bank Indonesia
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

        {/* Formal Document Body */}
        <div
          ref={printRef}
          className="p-8 sm:p-10 text-slate-800 space-y-6 print:p-8 bg-white"
        >
          {/* Formal Kop Surat Bank Indonesia & GenBI UNMA */}
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
              <p className="text-[10px] text-slate-500">
                Jl. K.H. Abdul Halim No. 103, Majalengka Kulon, Majalengka, Jawa Barat 45418
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

          {/* Judul Dokumen & Nomor */}
          <div className="text-center space-y-1">
            <h3 className="text-sm sm:text-base font-black text-slate-950 underline tracking-wide uppercase">
              RAPOR EVALUASI KEAKTIFAN & SURAT REKOMENDASI PENERIMA BEASISWA
            </h3>
            <p className="text-[10px] font-mono text-slate-500 font-bold">
              NOMOR: {studentId}/SK-EVAL/GENBI-UNMA/{new Date().getFullYear()}
            </p>
          </div>

          {/* Narasi Pembuka */}
          <p className="text-xs leading-relaxed text-slate-700 text-justify">
            Berdasarkan hasil evaluasi sistemik presensi kehadiran kegiatan, rapat pleno, dan keterlibatan aktif pelaksanaan Program Kerja (Proker) Komunitas Generasi Baru Indonesia (GenBI) Universitas Majalengka periode berjalan, Badan Pengurus Harian (BPH) dengan ini menerangkan data keaktifan atas mahasiswa:
          </p>

          {/* Identitas Mahasiswa */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Nama Lengkap</span>
              <span className="font-black text-slate-950 text-sm">{evaluation.full_name}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Nomor Pokok Mahasiswa (NPM)</span>
              <span className="font-mono font-bold text-slate-900">{studentId}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Divisi Kepengurusan</span>
              <span className="font-bold text-slate-800">{evaluation.division}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Jabatan / Amanah</span>
              <span className="font-bold text-slate-800">{roleName}</span>
            </div>
          </div>

          {/* Rincian Evaluasi Keaktifan */}
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Rekapitulasi Kehadiran & Akumulasi Poin</span>
            </h4>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Hadir (Sesi)</th>
                    <th className="py-2.5 px-3">Izin Resmi</th>
                    <th className="py-2.5 px-3">Alfa (Tanpa Ket.)</th>
                    <th className="py-2.5 px-3 text-center">Persentase (%)</th>
                    <th className="py-2.5 px-3 text-right">Total Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  <tr>
                    <td className="py-3 px-3 font-bold text-emerald-700">{evaluation.total_hadir} Kegiatan</td>
                    <td className="py-3 px-3">{evaluation.total_izin} Sesi</td>
                    <td className="py-3 px-3 text-rose-600">{evaluation.total_alfa} Sesi</td>
                    <td className="py-3 px-3 text-center font-black text-slate-900">{evaluation.attendance_percentage}%</td>
                    <td className="py-3 px-3 text-right font-black text-blue-700 text-sm">+{evaluation.total_points} Poin</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Predikat & Rekomendasi Resmi Bank Indonesia */}
          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-900">
                Predikat Keaktifan:
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                  evaluation.predicate === 'Sangat Aktif'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : evaluation.predicate === 'Aktif'
                    ? 'bg-blue-100 text-blue-900 border-blue-300'
                    : 'bg-rose-100 text-rose-900 border-rose-300'
                }`}
              >
                {evaluation.predicate}
              </span>
            </div>

            <div className="pt-1 border-t border-blue-200/60">
              <span className="text-[10px] font-black text-slate-500 uppercase block">
                Status Rekomendasi Beasiswa:
              </span>
              <p
                className={`text-xs font-black ${
                  isRecommended ? 'text-emerald-800' : 'text-rose-700'
                }`}
              >
                {recommendationText}
              </p>
            </div>
          </div>

          {/* Tanda Tangan & QR Code Verifikasi */}
          <div className="pt-4 grid grid-cols-12 gap-4 items-end">
            {/* QR Code Autentikasi Sistem */}
            <div className="col-span-4 flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <QRCodeSVG value={verificationUrl} size={64} level="M" />
              <div className="flex items-center gap-1 text-[8px] font-bold text-slate-500 mt-1">
                <ShieldCheck className="w-2.5 h-2.5 text-blue-600" />
                <span>SIMAK GENBI Validated</span>
              </div>
            </div>

            {/* Kolom Tanda Tangan BPH / Pembina */}
            <div className="col-span-8 text-right space-y-1 text-xs">
              <p className="text-slate-600">
                Majalengka, {formatDateLongIndo(new Date())}
              </p>
              <p className="font-bold text-slate-900">
                Pengurus Komunitas GenBI Komisariat UNMA
              </p>
              <p className="text-[10px] text-slate-500">
                Badan Pengurus Harian (BPH)
              </p>

              {/* Stempel / Digital Sign Placeholder */}
              <div className="py-4 text-center inline-block pr-6">
                <div className="inline-block px-3 py-1 rounded-lg border-2 border-dashed border-blue-400 text-[10px] font-black text-blue-700 uppercase tracking-widest bg-blue-50/50">
                  TERVERIFIKASI SISTEM SIMAK
                </div>
              </div>

              <p className="font-black text-slate-950 underline">
                Ahmad Fauzi
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                Ketua / BPH GenBI UNMA
              </p>
            </div>
          </div>
        </div>

        {/* Footer Modal Note */}
        <div className="px-8 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 print:hidden">
          <span>* Dokumen ini di-generate otomatis secara resmi dari SIMAK GENBI UNMA.</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
