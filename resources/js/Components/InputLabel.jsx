export default function InputLabel({ value, className = '', children, ...props }) {
    return (
        <label {...props} className={`fb-label ` + className}>
            {value ? value : children}
        </label>
    );
}
