import asyncio
from app.core.config import get_settings
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

settings = get_settings()

async def test_email():
    print("EMAIL_USER:", settings.EMAIL_USER)
    print("EMAIL_PASS:", "***" if settings.EMAIL_PASS else "EMPTY")
    
    msg = MIMEMultipart("alternative")
    msg["From"] = settings.EMAIL_USER
    msg["To"] = "gopalambhore371@gmail.com"
    msg["Subject"] = "SecureVault SMTP Test Mail"
    msg.attach(MIMEText("This is a diagnostic SMTP test email.", "plain"))

    try:
        await aiosmtplib.send(
            msg,
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=settings.EMAIL_USER,
            password=settings.EMAIL_PASS,
        )
        print("SUCCESS: Test email sent successfully!")
    except Exception as e:
        import traceback
        print("ERROR: Failed to send email:")
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_email())
