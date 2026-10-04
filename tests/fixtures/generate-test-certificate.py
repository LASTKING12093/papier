"""Creates an ephemeral, untrusted test identity. Never included in release bundles."""
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from datetime import datetime,timedelta,timezone
from pathlib import Path
key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
name=x509.Name([x509.NameAttribute(NameOID.COMMON_NAME,'PDF Editor ephemeral test')])
now=datetime.now(timezone.utc)
cert=x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(x509.random_serial_number()).not_valid_before(now-timedelta(minutes=1)).not_valid_after(now+timedelta(days=1)).sign(key,hashes.SHA256())
out=Path('tmp/qa');out.mkdir(parents=True,exist_ok=True)
(out/'test-identity.p12').write_bytes(pkcs12.serialize_key_and_certificates(b'ephemeral',key,cert,None,serialization.NoEncryption()))
