async def send_email(to: str, subject: str, body: str) -> bool:
    """Pretend to send email — real backend would call SES/Sendgrid."""
    return True


def format_subject(prefix: str, suffix: str) -> str:
    return f"{prefix}: {suffix}"
