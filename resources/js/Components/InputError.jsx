export default function InputError({ message, className = '', ...props }) {
    return message ? (
        <p {...props} className={'fb-error-text ' + className}>
            {message}
        </p>
    ) : null;
}
