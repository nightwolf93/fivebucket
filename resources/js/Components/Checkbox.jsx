export default function Checkbox({ className = '', ...props }) {
    return (
        <input
            {...props}
            type="checkbox"
            className={
                'rounded border-[var(--border)] bg-[var(--bg)] text-emerald-500 shadow-sm focus:ring-emerald-500 ' +
                className
            }
        />
    );
}
