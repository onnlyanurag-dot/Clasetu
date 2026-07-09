import React, { useState, useEffect, useRef } from "react";

interface TimeInputProps {
  label: string;
  value: string; // expecting "HH:MM AM"/"HH:MM PM", or ""
  onChange: (newValue: string) => void;
  id?: string;
  required?: boolean;
}

export default function TimeInput({ label, value, onChange, id, required = true }: TimeInputProps) {
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");

  // Keep track of the last value we notified the parent about.
  // This helps us differentiate between typing inside the inputs vs. external prop updates.
  const lastPropagatedValue = useRef<string>("");

  useEffect(() => {
    // If the value matches what we last propagated, it means the change originated from typing inside.
    // We should not overwrite the user's current raw input values.
    if (value === lastPropagatedValue.current) {
      return;
    }

    // Otherwise, the value changed from the outside (e.g. form reset, edit profile loaded, cancel, or default)
    lastPropagatedValue.current = value;

    if (value === "") {
      setHour("");
      setMinute("");
      setAmpm("AM");
    } else {
      const match = value.trim().match(/^(\d{1,2}):(\d{1,2})\s*(AM|PM)$/i);
      if (match) {
        setHour(match[1]);
        setMinute(match[2]);
        setAmpm(match[3].toUpperCase() as "AM" | "PM");
      }
    }
  }, [value]);

  const propagateChange = (h: string, m: string, ap: "AM" | "PM") => {
    if (h === "" || m === "") {
      lastPropagatedValue.current = "";
      onChange(""); // report incomplete/invalid to the parent form validation
    } else {
      const paddedH = h.padStart(2, "0");
      const paddedM = m.padStart(2, "0");
      const formatted = `${paddedH}:${paddedM} ${ap}`;
      lastPropagatedValue.current = formatted;
      onChange(formatted);
    }
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    setHour(rawVal);
    propagateChange(rawVal, minute, ampm);
  };

  const handleHourBlur = () => {
    if (hour !== "") {
      let num = parseInt(hour, 10);
      if (isNaN(num) || num < 1 || num > 12) {
        // Correct to 12 if invalid hour entered
        num = 12;
      }
      const paddedH = num.toString().padStart(2, "0");
      setHour(paddedH);
      propagateChange(paddedH, minute, ampm);
    }
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "");
    setMinute(rawVal);
    propagateChange(hour, rawVal, ampm);
  };

  const handleMinuteBlur = () => {
    if (minute !== "") {
      let num = parseInt(minute, 10);
      if (isNaN(num) || num < 0 || num > 59) {
        // Correct to 00 if invalid minute entered
        num = 0;
      }
      const paddedM = num.toString().padStart(2, "0");
      setMinute(paddedM);
      propagateChange(hour, paddedM, ampm);
    }
  };

  const handleAmpmChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const ap = e.target.value as "AM" | "PM";
    setAmpm(ap);
    propagateChange(hour, minute, ap);
  };

  return (
    <div className="flex flex-col gap-1.5 animate-fade-in" id={id}>
      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <div className="flex items-center gap-2">
        {/* SIDE-BY-SIDE NUMERIC INPUTS formatted like "00:00" */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition-all w-full max-w-[130px]">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            placeholder="12"
            value={hour}
            onBlur={handleHourBlur}
            onChange={handleHourChange}
            className="w-8 bg-transparent text-slate-800 text-sm font-semibold font-mono text-center focus:outline-none"
            aria-label={`${label} Hours`}
          />
          <span className="text-slate-400 font-mono font-bold mx-0.5">:</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            placeholder="00"
            value={minute}
            onBlur={handleMinuteBlur}
            onChange={handleMinuteChange}
            className="w-8 bg-transparent text-slate-800 text-sm font-semibold font-mono text-center focus:outline-none"
            aria-label={`${label} Minutes`}
          />
        </div>

        {/* AM/PM Dropdown SELECTOR next to numeric inputs */}
        <select
          value={ampm}
          onChange={handleAmpmChange}
          className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer h-[34px]"
          aria-label={`${label} AM or PM`}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  );
}
