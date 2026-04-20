"use client";

import { CustomAttribute, CustomAttributeType } from "@/lib/types";

interface Props {
  attributes: CustomAttribute[];
  onChange: (attrs: CustomAttribute[]) => void;
  showCurrent?: boolean; // false for templates (no "current" concept at template level)
}

const TYPE_OPTIONS: { value: CustomAttributeType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "boolean", label: "Yes/No" },
  { value: "date", label: "Date" },
];

function defaultValueForType(t: CustomAttributeType) {
  if (t === "number") return 0;
  if (t === "boolean") return false;
  return "";
}

function renderValueInput(
  attr: CustomAttribute,
  field: "goal" | "current",
  onUpdate: (val: string | number | boolean | null) => void
) {
  const val = attr[field];
  const common =
    "w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  switch (attr.type) {
    case "number":
      return (
        <input
          type="number"
          value={val == null ? "" : String(val)}
          onChange={(e) => onUpdate(e.target.value === "" ? null : parseFloat(e.target.value))}
          className={common}
          step="any"
        />
      );
    case "boolean":
      return (
        <select
          value={val === true ? "true" : val === false ? "false" : ""}
          onChange={(e) => onUpdate(e.target.value === "true")}
          className={common}
        >
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof val === "string" ? val : ""}
          onChange={(e) => onUpdate(e.target.value)}
          className={common}
        />
      );
    default:
      return (
        <input
          type="text"
          value={val == null ? "" : String(val)}
          onChange={(e) => onUpdate(e.target.value)}
          className={common}
          placeholder={field === "goal" ? "Target" : "Current"}
        />
      );
  }
}

export default function CustomAttributesEditor({
  attributes,
  onChange,
  showCurrent = true,
}: Props) {
  function updateAttr(index: number, patch: Partial<CustomAttribute>) {
    const next = attributes.map((a, i) => (i === index ? { ...a, ...patch } : a));
    onChange(next);
  }

  function removeAttr(index: number) {
    onChange(attributes.filter((_, i) => i !== index));
  }

  function addAttr() {
    onChange([
      ...attributes,
      {
        name: "",
        type: "text",
        goal: defaultValueForType("text"),
        current: showCurrent ? defaultValueForType("text") : undefined,
      },
    ]);
  }

  function changeType(index: number, newType: CustomAttributeType) {
    updateAttr(index, {
      type: newType,
      goal: defaultValueForType(newType),
      current: showCurrent ? defaultValueForType(newType) : undefined,
    });
  }

  return (
    <div className="space-y-3">
      {attributes.length === 0 && (
        <p className="text-xs italic text-gray-400">
          No custom attributes. Add one to track progress, goals, or any other data.
        </p>
      )}

      {attributes.map((attr, i) => (
        <div
          key={i}
          className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <input
              type="text"
              value={attr.name}
              onChange={(e) => updateAttr(i, { name: e.target.value })}
              placeholder="Attribute name (e.g. Jobs applied)"
              maxLength={100}
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={attr.type}
              onChange={(e) => changeType(i, e.target.value as CustomAttributeType)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeAttr(i)}
              className="min-h-[32px] min-w-[32px] rounded-md bg-red-50 px-2 text-red-600 hover:bg-red-100"
              title="Remove attribute"
            >
              &times;
            </button>
          </div>

          <div className={`grid gap-2 ${showCurrent ? "sm:grid-cols-2" : ""}`}>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-gray-600">
                {showCurrent ? "Goal" : "Default value"}
              </label>
              {renderValueInput(attr, "goal", (v) => updateAttr(i, { goal: v }))}
            </div>
            {showCurrent && (
              <div>
                <label className="mb-0.5 block text-xs font-medium text-gray-600">
                  Current
                </label>
                {renderValueInput(attr, "current", (v) => updateAttr(i, { current: v }))}
              </div>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addAttr}
        className="min-h-[36px] rounded-md border border-dashed border-gray-300 bg-white px-4 py-1.5 text-sm font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
      >
        + Add Attribute
      </button>
    </div>
  );
}
