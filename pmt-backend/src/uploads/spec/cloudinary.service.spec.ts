import { CloudinaryService, UploadedAsset } from '../cloudinary.service';

/**
 * The batch semantics, tested through a stubbed single upload.
 *
 * `upload` itself is a thin wrapper around Cloudinary's stream API and is not
 * worth mocking the SDK for. What IS worth pinning is what `uploadMany` does
 * when part of a batch fails, because that is the behaviour a caller depends on
 * and cannot see from the signature.
 */
describe('CloudinaryService batch behaviour', () => {
  let service: CloudinaryService;

  function file(name: string): Express.Multer.File {
    return {
      originalname: name,
      buffer: Buffer.from(name),
    } as Express.Multer.File;
  }

  function asset(publicId: string): UploadedAsset {
    return {
      url: `https://res.cloudinary.com/${publicId}`,
      publicId,
      resourceType: 'image',
      bytes: 100,
      originalFilename: publicId,
    };
  }

  beforeEach(() => {
    service = new CloudinaryService();
  });

  describe('uploadManySettled', () => {
    it('reports each file independently and never throws', async () => {
      jest
        .spyOn(service, 'upload')
        .mockImplementation((f: Express.Multer.File) =>
          f.originalname === 'bad.pdf'
            ? Promise.reject(new Error('too large'))
            : Promise.resolve(asset(f.originalname)),
        );

      const results = await service.uploadManySettled(
        [file('a.png'), file('bad.pdf'), file('c.png')],
        { folder: 'pmt/test' },
      );

      expect(results.map((r) => r.ok)).toEqual([true, false, true]);
      const failure = results[1] as { filename: string; error: string };
      expect(failure.filename).toBe('bad.pdf');
      expect(failure.error).toBe('too large');
    });

    it('uploads concurrently rather than one after another', async () => {
      // A ten file batch should cost one round trip of wall clock, not ten.
      let inFlight = 0;
      let peak = 0;
      jest.spyOn(service, 'upload').mockImplementation((f) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        return new Promise((resolve) =>
          setTimeout(() => {
            inFlight -= 1;
            resolve(asset(f.originalname));
          }, 5),
        );
      });

      await service.uploadManySettled(['a', 'b', 'c', 'd'].map(file), {
        folder: 'pmt/test',
      });
      expect(peak).toBeGreaterThan(1);
    });
  });

  describe('uploadMany', () => {
    it('returns every asset when the whole batch succeeds', async () => {
      jest
        .spyOn(service, 'upload')
        .mockImplementation((f) => Promise.resolve(asset(f.originalname)));

      const assets = await service.uploadMany([file('a.png'), file('b.png')], {
        folder: 'pmt/test',
      });
      expect(assets.map((a) => a.publicId)).toEqual(['a.png', 'b.png']);
    });

    it('deletes what already landed when any file fails', async () => {
      // Otherwise a failed batch leaves orphaned assets in Cloudinary that
      // nothing references and nobody will ever find.
      jest
        .spyOn(service, 'upload')
        .mockImplementation((f) =>
          f.originalname === 'bad.pdf'
            ? Promise.reject(new Error('rejected by Cloudinary'))
            : Promise.resolve(asset(f.originalname)),
        );
      const remove = jest.spyOn(service, 'delete').mockResolvedValue();

      await expect(
        service.uploadMany([file('a.png'), file('bad.pdf'), file('c.png')], {
          folder: 'pmt/test',
        }),
      ).rejects.toThrow('bad.pdf');

      // Asserted WITH the resource type, not only the id: passing the wrong one
      // is a delete that removes nothing, so the argument is the whole point.
      expect(
        remove.mock.calls
          .map(([publicId, resourceType]) => `${publicId}:${resourceType}`)
          .sort(),
      ).toEqual(['a.png:image', 'c.png:image']);
    });

    it('names the first failure, and says how many others there were', async () => {
      jest
        .spyOn(service, 'upload')
        .mockImplementation(() => Promise.reject(new Error('nope')));
      jest.spyOn(service, 'delete').mockResolvedValue();

      await expect(
        service.uploadMany([file('a.png'), file('b.png')], { folder: 'x' }),
      ).rejects.toThrow('and 1 more');
    });

    it('still throws when the rollback itself fails', async () => {
      // A cleanup failure must not mask the upload failure that caused it.
      jest
        .spyOn(service, 'upload')
        .mockImplementation((f) =>
          f.originalname === 'bad.pdf'
            ? Promise.reject(new Error('nope'))
            : Promise.resolve(asset(f.originalname)),
        );
      jest
        .spyOn(service, 'delete')
        .mockRejectedValue(new Error('delete failed'));

      await expect(
        service.uploadMany([file('a.png'), file('bad.pdf')], { folder: 'x' }),
      ).rejects.toThrow('bad.pdf');
    });
  });

  describe('deleteMany', () => {
    it('never throws, because a failed cleanup must not fail the action', async () => {
      jest
        .spyOn(service, 'delete')
        .mockImplementation((publicId) =>
          publicId === 'b'
            ? Promise.reject(new Error('gone'))
            : Promise.resolve(),
        );

      await expect(
        service.deleteMany([
          { publicId: 'a', resourceType: 'image' },
          { publicId: 'b', resourceType: 'image' },
        ]),
      ).resolves.toBeUndefined();
    });

    it('passes each asset its own resource type', async () => {
      // Cloudinary partitions its namespace by resource type: destroying a
      // video with the default 'image' silently deletes nothing.
      const remove = jest.spyOn(service, 'delete').mockResolvedValue();
      await service.deleteMany([
        { publicId: 'a', resourceType: 'video' },
        { publicId: 'b', resourceType: 'raw' },
      ]);
      expect(remove.mock.calls).toEqual([
        ['a', 'video'],
        ['b', 'raw'],
      ]);
    });
  });
});

describe('CloudinaryService.delete', () => {
  let service: CloudinaryService;
  let destroy: jest.Mock;

  beforeEach(() => {
    service = new CloudinaryService();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { v2 } = require('cloudinary') as {
      v2: { uploader: { destroy: jest.Mock } };
    };
    destroy = jest.fn();
    v2.uploader.destroy = destroy;
  });

  it("throws when Cloudinary answers 'not found'", async () => {
    // The whole reason this method inspects its result. `destroy` RESOLVES with
    // `{ result: 'not found' }` for a publicId or resourceType that matches
    // nothing, so awaiting and discarding the answer reported success for a
    // delete that removed nothing: the row went and the bytes stayed publicly
    // reachable at their URL forever.
    destroy.mockResolvedValue({ result: 'not found' });
    await expect(service.delete('p1', 'image')).rejects.toThrow('not found');
  });

  it("resolves when Cloudinary answers 'ok'", async () => {
    destroy.mockResolvedValue({ result: 'ok' });
    await expect(service.delete('p1', 'raw')).resolves.toBeUndefined();
    expect(destroy).toHaveBeenCalledWith('p1', { resource_type: 'raw' });
  });

  it('treats an unrecognised answer as failure', async () => {
    // Defaulting to success is how the original bug worked.
    destroy.mockResolvedValue({ result: 'something new' });
    await expect(service.delete('p1', 'image')).rejects.toThrow(
      'something new',
    );
  });

  describe('deleteUnknownResourceType', () => {
    it('tries each type until one deletes', async () => {
      destroy.mockImplementation(
        (_publicId: string, options: { resource_type: string }) =>
          Promise.resolve({
            result: options.resource_type === 'raw' ? 'ok' : 'not found',
          }),
      );

      await expect(
        service.deleteUnknownResourceType('legacy'),
      ).resolves.toBeUndefined();
      expect(
        destroy.mock.calls.map(
          ([, options]: [string, { resource_type: string }]) =>
            options.resource_type,
        ),
      ).toEqual(['image', 'video', 'raw']);
    });

    it('stops at the first success rather than deleting three times', async () => {
      destroy.mockResolvedValue({ result: 'ok' });
      await service.deleteUnknownResourceType('legacy');
      expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('throws when no type matches, so the orphan is reported', async () => {
      destroy.mockResolvedValue({ result: 'not found' });
      await expect(service.deleteUnknownResourceType('legacy')).rejects.toThrow(
        'any resource type',
      );
    });
  });
});
