import React, { useMemo } from 'react';
import { Clock, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { formatDateTimeWIB } from '../lib/dateUtils';

interface WibDateTimePickerProps {
  value: string; // ISO string or YYYY-MM-DDTHH:mm
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

export const WibDateTimePicker: React.FC<WibDateTimePickerProps> = ({
  value,
  onChange,
  label = 'Tanggal & Jam Pelaksanaan',
  required = false,
}) => {
  // Parse date and time components from value
  const { datePart, hourPart, minutePart } = useMemo(() => {
    let d = value ? new Date(value) : new Date();
    if (isNaN(d.getTime())) d = new Date();

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    return {
      datePart: `${year}-${month}-${day}`,
      hourPart: hours,
      minutePart: minutes,
    };
  }, [value]);

  const updateDateTime = (newDate: string, newHour: string, newMinute: string) => {
    const combinedString = `${newDate}T${newHour}:${newMinute}:00`;
    const d = new Date(combinedString);
    if (!isNaN(d.getTime())) {
      onChange(d.toISOString());
    } else {
      onChange(combinedString);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    if (!newDate) return;
    updateDateTime(newDate, hourPart, minutePart);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDateTime(datePart, e.target.value, minutePart);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateDateTime(datePart, hourPart, e.target.value);
  };

  const applyPreset = (hour: string, minute: string) => {
    updateDateTime(datePart, hour, minute);
  };

  const setNow = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    updateDateTime(`${year}-${month}-${day}`, hours, minutes);
  };

  // Generate 24 hours (00 to 23)
  const hoursList = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  // Generate 60 minutes (00 to 59)
  const minutesList = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-slate-600 uppercase flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
          <span>{label}</span>
        </label>
        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-black tracking-tight">
          WIB (Format 24 Jam)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        {/* Input Tanggal Khusus - Tanpa Popup Jam Browser */}
        <div className="sm:col-span-7">
          <div className="relative">
            <input
              type="date"
              required={required}
              value={datePart}
              onChange={handleDateChange}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none font-semibold text-slate-800 bg-white"
            />
          </div>
        </div>

        {/* Pemilih Waktu 24 Jam (Jam : Menit WIB) */}
        <div className="sm:col-span-5 flex items-center gap-1">
          <div className="flex-1">
            <select
              value={hourPart}
              onChange={handleHourChange}
              className="w-full px-2 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-black text-slate-900 text-center"
              title="Pilih Jam (00 - 23 WIB)"
            >
              {hoursList.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <span className="font-black text-slate-400 text-sm">:</span>

          <div className="flex-1">
            <select
              value={minutePart}
              onChange={handleMinuteChange}
              className="w-full px-2 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-600/30 focus:outline-none bg-white font-black text-slate-900 text-center"
              title="Pilih Menit (00 - 59)"
            >
              {minutesList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <span className="px-1.5 py-1 text-[10px] font-black text-blue-700 bg-blue-50 rounded-lg border border-blue-200">
            WIB
          </span>
        </div>
      </div>

      {/* Quick Presets Jam WIB */}
      <div className="flex flex-wrap items-center gap-1 pt-0.5">
        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 mr-1">
          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
          <span>Preset:</span>
        </span>
        <button
          type="button"
          onClick={setNow}
          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          Sekarang
        </button>
        <button
          type="button"
          onClick={() => applyPreset('08', '00')}
          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          08:00 WIB
        </button>
        <button
          type="button"
          onClick={() => applyPreset('13', '30')}
          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          13:30 WIB
        </button>
        <button
          type="button"
          onClick={() => applyPreset('16', '00')}
          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          16:00 WIB
        </button>
        <button
          type="button"
          onClick={() => applyPreset('19', '30')}
          className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
        >
          19:30 WIB
        </button>
      </div>

      {/* Live Preview Format 24 Jam */}
      <div className="text-[11px] font-bold text-blue-700 bg-blue-50/80 px-2.5 py-1.5 rounded-xl border border-blue-200/70 flex items-center justify-between mt-1">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Waktu Terpilih: {formatDateTimeWIB(value || new Date().toISOString())}</span>
        </div>
        <span className="text-[9px] uppercase font-black tracking-wider text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
          24 Jam Murni
        </span>
      </div>
    </div>
  );
};
