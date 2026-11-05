import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  labelledBy: string;
  disabled?: boolean;
}

/** On/off control with a visible label elsewhere (aria-labelledby). */
export const Switch: React.FC<SwitchProps> = ({ checked, onChange, labelledBy, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby={labelledBy}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`settings-switch ${checked ? 'is-on' : ''}`}
  >
    <span className="settings-switch-thumb" aria-hidden="true" />
  </button>
);
