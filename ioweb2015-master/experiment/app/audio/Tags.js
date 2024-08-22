/**
 * Copyright 2015 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * A singleton lookup of bitmask tag information.
 */
module.exports = (function Tags() {
  'use strict';

  var tags = Object.create(null);
  var tagIndex = 0;

  /**
   * Define a new tag by name.
   * @param {string} name - The tag name.
   * @return {number}
   */
  function addTag(name) {
    if ('undefined' !== typeof tags[name]) {
      return tags[name];
    }

    if (tagIndex > 32) {
      throw 'Too many bits';
    }

    var bin = 1 << tagIndex++;
    tags[name] = bin;
    return bin;
  }

  /**
   * Get a tag by name.
   * @param {string} name - The tag name.
   * @return {number}
   */
  function getTag(name) {
    var bin = tags[name];

    if ('undefined' === typeof bin) {
      throw `Unknown tag: ${name}`;
    }

    return tags[name];
  }

  /**
   * See if one tag matches another.
   * @param {number} data - The first tag.
   * @param {number} tags - The second tag.
   * @return {number}
   */
  function matches(data, tags) {
    return (data & tags) !== 0;
  }

  return {
    addTag: addTag,
    getTag: getTag,
    matches: matches
  };
})();
