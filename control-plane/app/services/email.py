from email.message import EmailMessage
import smtplib

from app.core.config import settings

class EmailDeliveryError(RuntimeError):
    pass

def send_verification_email(*, recipient: str, first_name: str, token: str) -> None:
    if not all((settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.email_from)):
        if settings.environment != "production":
            return
        raise EmailDeliveryError("Email delivery is not configured")
    link = f"{settings.public_base_url.rstrip('/')}/verify-email?token={token}"
    message = EmailMessage()
    message["Subject"] = "Verify your ORDIUM account"
    message["From"] = settings.email_from
    message["To"] = recipient
    message.set_content(
        f"Hello {first_name},\n\nVerify your ORDIUM account using this link:\n{link}\n\nThis link expires in 30 minutes.\n"
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_username, settings.smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise EmailDeliveryError("Unable to deliver verification email") from exc
