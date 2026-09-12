import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))

import pet_archive


class _Response:
    def __init__(self, status_code):
        self.status_code = status_code

    def raise_for_status(self):
        raise AssertionError('empty archive response must not be raised')


class _Client:
    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def get(self, *_args, **_kwargs):
        return _Response(400)


class PetArchiveTest(unittest.TestCase):
    def test_uninitialized_mediamtx_path_is_empty_archive(self):
        with patch.object(pet_archive, 'authorize', new=AsyncMock()), \
             patch.object(pet_archive, 'token_for', new=AsyncMock(return_value='token')), \
             patch.object(pet_archive.httpx, 'AsyncClient', return_value=_Client()):
            result = asyncio.run(pet_archive.recordings('camera', object()))
        self.assertEqual(result, [])


if __name__ == '__main__':
    unittest.main()
