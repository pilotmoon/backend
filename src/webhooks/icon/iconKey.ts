import { sha256 } from 'js-sha256';
import { baseEncode, alphabets } from '@pilotmoon/chewit';
import { IconDescriptor } from './icon.js';

export function calculateIconKey(descriptor: IconDescriptor) {
    const hash = sha256.create().update(descriptor.specifier).array();
    let key = 'i' + baseEncode(hash, alphabets.base58Flickr).slice(-11);
    if (descriptor.flipHorizontal) {
        key += "h";
    }
    if (descriptor.flipVertical) {
        key += "v";
    }
    if (descriptor.preserveAspect) {
        key += "a";
    }
    if (descriptor.preserveColor) {
        key += "c";
    }
    if (descriptor.scale) {
        key += "s" + Math.round(descriptor.scale*100);
    }
    if (descriptor.color) {
        key += `-${descriptor.color.slice(1)}`;
    }
    console.log("calculated key", key);
    return key;
}
