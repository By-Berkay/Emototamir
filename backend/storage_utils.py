"""Dosya depolama: MongoDB GridFS.

Fotoğraf ve logolar uygulamanın kendi MongoDB veritabanında tutulur; harici bir
depolama servisi gerekmez. Atlas M0 ücretsiz planında toplam depolama 512 MB'tır.
"""
import logging

from gridfs.errors import NoFile
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

logger = logging.getLogger("storage")

APP_NAME = "moto-servis"
_bucket: AsyncIOMotorGridFSBucket | None = None


def init_storage(db) -> None:
    """Uygulama açılışında bir kez çağrılır."""
    global _bucket
    _bucket = AsyncIOMotorGridFSBucket(db, bucket_name="app_files")
    logger.info("GridFS dosya deposu hazır")


def _get_bucket() -> AsyncIOMotorGridFSBucket:
    if _bucket is None:
        raise RuntimeError("Dosya deposu başlatılmadı")
    return _bucket


async def put_object(path: str, data: bytes, content_type: str) -> dict:
    bucket = _get_bucket()
    # GridFS'te dosya kimliği tekildir; aynı yola yazılırsa önce eski sürüm silinir.
    try:
        await bucket.delete(path)
    except NoFile:
        pass
    await bucket.upload_from_stream_with_id(
        path,
        path.rsplit("/", 1)[-1],
        data,
        metadata={"content_type": content_type},
    )
    return {"path": path, "size": len(data), "content_type": content_type}


async def get_object(path: str) -> tuple[bytes, str]:
    bucket = _get_bucket()
    try:
        stream = await bucket.open_download_stream(path)
    except NoFile as exc:
        raise FileNotFoundError(path) from exc
    data = await stream.read()
    content_type = (stream.metadata or {}).get("content_type", "application/octet-stream")
    return data, content_type
