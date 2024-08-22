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

var PIXI = require('pixi.js/bin/pixi.dev.js');
var p2 = require('p2');
var animate = require('app/util/animate');
var {Promise} = require('es6-promise');
var {generateTexture} = require('app/util/generateTexture');

module.exports = (function() {
  'use strict';

  /**
   * Creates a new drum.
   * @param {Object} model - The model for this drum.
   * @param {string} color - The color for this drum.
   * @param {string} hoverColor - The hover color for this drum.
   * @param {string} soundName - The soundName for this drum.
   * @param {Object} physicsWorld - The physics for this drum.
   * @constructor
   */
  return function Drum(model, color, hoverColor, soundName, physicsWorld, renderer) {
    var pid = model.pid;
    var isDragging = false;
    var interactionData;

    var container = new PIXI.DisplayObjectContainer();

    var shape = new PIXI.Circle(0, 0, model.radius);

    var circleGraphic = new PIXI.Graphics();
    circleGraphic.beginFill(0xffffff);
    circleGraphic.drawShape(shape);
    circleGraphic.endFill();

    var circleTexture = generateTexture(circleGraphic);
    renderer.updateTexture(circleTexture.baseTexture);

    var circle = new PIXI.Sprite(circleTexture);
    circle.position.x = circle.position.y = -model.radius;
    circle.tint = color;

    var shadow = new PIXI.Graphics();
    var blurFilter = new PIXI.BlurFilter();
    shadow.boundsPadding = 10;
    shadow.filters = [blurFilter];
    shadow.beginFill(0x000000, 0.2);
    shadow.drawShape(shape);
    shadow.endFill();
    shadow.position.y = -4;
    shadow.position.x = 3;
    container.addChild(shadow);
    container.addChild(circle);

    var hitCircleGfx = new PIXI.Graphics();
    hitCircleGfx.beginFill(0x4527A0, 0.6);
    hitCircleGfx.drawShape(shape);
    hitCircleGfx.endFill();

    var hitTexture = generateTexture(hitCircleGfx);
    renderer.updateTexture(hitTexture.baseTexture);

    var hitCircleContainer = new PIXI.DisplayObjectContainer();

    var self = {
      pid,
      soundName,
      container,
      hitCircleContainer,
      render,
      activate,
      addEventListeners,
      removeEventListeners,
      onActivate,
      onDragStart,
      onDragEnd,
      setPosition,
      showCollision,
      tearDown
    };

    var physicsBody = addToPhysics();

    /**
     * Add event listeners.
     */
    function addEventListeners() {
      container.interactive = true;
      container.buttonMode = true;
      circle.interactive = true;

      container.mousedown = container.touchstart = function(data) {
        if (onDragStartCallback_) {
          if (!onDragStartCallback_(self)) { return; }
        }

        interactionData = data;
        container.alpha = 0.8;

        animate.to(container.scale, 0.5, { x: 1.1, y: 1.1 });
        animate.to(shadow.position, 0.5, { x: 3, y: -12 });
        isDragging = true;
      };

      // set the events for when the mouse is released or a touch is released
      container.mouseup = container.mouseupoutside = container.touchend = container.touchendoutside = function() {
        if (onDragEndCallback_) {
          if (!onDragEndCallback_(self)) { return; }
        }

        container.alpha = 1;
        isDragging = false;
        interactionData = null;

        animate.to(container.scale, 0.5, { x: 1, y: 1 });
        animate.to(shadow.position, 0.5, { x: 3, y: -4 });
      };

      circle.mouseover = function() {
        circle.tint = hoverColor;
      };

      circle.mouseout = function() {
        circle.tint = color;
      };

      // set the callbacks for when the mouse or a touch moves
      container.mousemove = container.touchmove = function() {
        if (!isDragging) { return; }

        // get parent coords
        var newPosition = interactionData.getLocalPosition(container.parent);
        setPosition(newPosition.x, newPosition.y);
      };
    }

    /**
     * Remove event listeners.
     */
    function removeEventListeners() {
      container.interactive = false;
      container.buttonMode = false;
      circle.interactive = false;

      container.mousedown = container.touchstart = null;
      container.mouseup = container.mouseupoutside = container.touchend = container.touchendoutside = null;
      container.mousemove = container.touchmove = null;
    }

    /**
     * Cleanup.
     */
    function tearDown() {
      physicsWorld.removeBody(physicsBody);
      removeEventListeners();
      onActivationCallback_ = null;
      onDragStartCallback_ = null;
      onDragEndCallback_ = null;
    }

    /**
     * On activate callback.
     * @param {function} cb - The activation callback.
     */
    var onActivationCallback_;
    function onActivate(cb) {
      onActivationCallback_ = cb;
    }

    /**
     * On drag start callback.
     * @param {function} cb - The callback.
     */
    var onDragStartCallback_;
    function onDragStart(cb) {
      onDragStartCallback_ = cb;
    }

    /**
     * On drag end callback.
     * @param {function} cb - The callback.
     */
    var onDragEndCallback_;
    function onDragEnd(cb) {
      onDragEndCallback_ = cb;
    }

    /**
     * Activate drum ball.
     * @param {Object} ball - The ball object.
     */
    function activate(ball) {
      showCollision(0);
      if (onActivationCallback_) {
        onActivationCallback_(self, ball);
      }
    }

    var tweenData = { y: 0 };

    /**
     * Update the visual position of the drum during a tween.
     */
    function visualUpdate() {
      container.position.y = tweenData.y;
    }

    /**
     * Animate out a ring from the drum.
     * @param {number} delay - The delay duration.
     * @return {Promise}
     */
    function collisionRing(delay) {
      var hitCircle = new PIXI.Sprite(hitTexture);
      hitCircle.alpha = 0;
      hitCircle.anchor.x = hitCircle.anchor.y = 0.5;
      hitCircle.alpha = 0.8;
      hitCircle.position.x = container.position.x;
      hitCircle.position.y = container.position.y;

      hitCircleContainer.addChildAt(hitCircle, 0);

      return Promise.all([
        animate.to(hitCircle.scale, 1.2, { x: 3, y: 3, delay: delay, ease: Cubic.easeOut }),
        animate.to(hitCircle, 1.2, { alpha: 0, delay: delay, ease: Cubic.easeOut })
      ]).then(function() {
        hitCircleContainer.removeChild(hitCircle);
      });
    }

    /**
     * Emit a circle.
     * @param {number=0} delay - The delay duration.
     */
    function showCollision(delay) {
      delay = delay || 0;

      tweenData.y = model.y - 25;
      TweenMax.killTweensOf(tweenData);
      TweenMax.to(tweenData, 0.2, { y: model.y, onUpdate: visualUpdate, ease: Expo.easeOut });

      collisionRing(delay);
    }

    /**
     * Add drum object to physics.
     */
    function addToPhysics() {
      var shapeDef = new p2.Circle(model.radius);
      var bodyDef = new p2.Body({
        position: [0, 0],
        mass: 0,
        type: 4
      });

      bodyDef.addShape(shapeDef);
      physicsWorld.addBody(bodyDef);

      bodyDef.drum = self;
      return bodyDef;
    }

    var drumPosition = { x: 0, y: 0 };

    /**
     * Set position of the drum.
     * @param {number} x - The X position of the drum.
     * @param {number} y - The Y position of the drum.
     */
    function setPosition(x, y) {
      drumPosition.x = x;
      drumPosition.y = y;

      animate.to(container.position, 0.1, drumPosition);

      model.x = physicsBody.position[0] = x;
      model.y = physicsBody.position[1] = y;
    }

    function render() {
      // no-op
    }

    return self;
  };
})();
