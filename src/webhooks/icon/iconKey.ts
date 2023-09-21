import { sha256 } from 'js-sha256';
import { baseEncode, alphabets } from '@pilotmoon/chewit';

export function calculateIconKey(specifier: string) {
    const hash = sha256.create().update(specifier).array();
    const key = 'i' + baseEncode(hash, alphabets.base58Flickr).slice(-11);
    console.log("calculate key", key);
    return key;
}
