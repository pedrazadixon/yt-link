/* ====================================================================================
__   __  ___   __    _  ___     _______  ___      _______  __   __  _______  ______
|  |_|  ||   | |  |  | ||   |   |       ||   |    |   _   ||  | |  ||       ||    _ |
|       ||   | |   |_| ||   |   |    _  ||   |    |  |_|  ||  |_|  ||    ___||   | ||
|       ||   | |       ||   |   |   |_| ||   |    |       ||       ||   |___ |   |_||_
|       ||   | |  _    ||   |   |    ___||   |___ |       ||_     _||    ___||    __  |
| ||_|| ||   | | | |   ||   |   |   |    |       ||   _   |  |   |  |   |___ |   |  | |
|_|   |_||___| |_|  |__||___|   |___|    |_______||__| |__|  |___|  |_______||___|  |_|

Inspired by Day 005 of Paul Flavius Nechita 100 Days of UI challenge.
This connects to specific tracks to soundcloud, but it should be possible to
modifiy the interface to handle real soundcloud playlists instead.

Anyway - due to cross domain restriction the layout behavior
won't work out of the box with soundcloud, you'll need a local copy of
the image(s) or soundcloud changes the headers.

Playing with canvas, viewport units and audio to bring this to live.
==================================================================================== */
/* dependencies:
 * https://facebook.github.io/rebound-js/rebound.js (used for aninmations)
 * https://connect.soundcloud.com/sdk/sdk-3.0.0.js soundcloud API
 *
 *
 */

// soundcloud clientID go to https://developers.soundcloud.com/ to receive yours
var soundcloudClientID = '946f66f72c8ebbaefc4fa6077c80286a';

/* Object.assign, polyfill for older browser */
if (typeof Object.assign != 'function') {
    (function () {
        Object.assign = function (target) {
            'use strict';
            if (target === undefined || target === null) {
                throw new TypeError('polyrize: cannot convert undefined or null to object');
            }
            var output = Object(target);
            for (var index = 1; index < arguments.length; index++) {
                var source = arguments[index];
                if (source !== undefined && source !== null) {
                    for (var nextKey in source) {
                        if (source.hasOwnProperty(nextKey)) {
                            output[nextKey] = source[nextKey];
                        }
                    }
                }
            }
            return output;
        };
    })();
}

/* all methods to handle the interface itself */
var ui = (function () {
    // default colorsets for player (black) and highlights
    var detaultColors = [[0, 0, 0][255, 78, 116]],
        spring = new rebound.SpringSystem(),
        scrollAnimation = spring.createSpring(50, 10),
        toMove = find('.playlist'),
        currentTrackID = 65852671,
        currentTrackInfo = {},
        scPlayer, scTimer,
        playerLoaded = false;
    slideIn = function (el, val) {
        el.style.width = val + '%';
    };

    /* REBOUND.JS */
    scrollAnimation.addListener({
        onSpringUpdate: function onSpringUpdate(spring) {
            var current = spring.getCurrentValue();
            var val = rebound.MathUtil.mapValueInRange(current, 0, 1, 0, 100);
            slideIn(toMove, val);
        },
        onSpringAtRest: function () {
            if (document.body.classList.contains('showlist')) {
                document.body.classList.remove("showlist");
            } else {
                document.body.className += 'showlist';
            }
        }
    });

    /* minimize selection code */
    function findAll(selector, context) {
        context = context || document;
        return context.querySelectorAll(selector);
    }

    function find(selector, context) {
        context = context || document;
        return context.querySelector(selector);
    }

    /* helper to format the 'huge' headline
     * Using a real monospaced font would help
     * to adapt it perfectly.
     * @TODO Refactor! this is full of magic numbers
     */
    function doExtendedInfo() {
        var hdl = find('.player-extended h1'),
            text = hdl.textContent, l = text.length, f, s = 1,
            oW = window.innerWidth, rect;
        if (l) {
            f = Math.ceil(100 / l);
            hdl.style.fontSize = (f * s) + 'vw';

            for (var i = 0; i < 20; i++) {
                rect = hdl.getBoundingClientRect();
                hdl.style.fontSize = (f * s) + 'vw';
                s += 0.1;
                if (Math.floor(rect.width) > oW) {
                    hdl.style.fontSize = (f * (s - 0.3)) + 'vw';
                    break;
                }
            }
            hdl.style.lineHeight = (f * (s - 0.3)) + 'vw';
        }
    }

    /*
     * some kind of fit text to box
     * used for title
     */
    function getTitleFontSize(text, w) {
        var bw, size = 36, tester = document.createElement('div');
        document.body.appendChild(tester);
        tester.style.fontSize = size + 'px';
        tester.className = 'font-size-test';
        tester.innerHTML = text;
        bw = tester.getBoundingClientRect().width;
        while (bw > w) {
            size = size - 1;
            bw = tester.getBoundingClientRect().width;
            tester.style.fontSize = size + 'px';
        }
        document.body.removeChild(tester);
        return size;
    }

    /* colorize the interface on base of the extracted colors
     * @param array uiColors (darfk and light color);
    */
    function colorizeUI(uiColors) {
        document.body.style.backgroundColor = 'rgb(' + uiColors[1].join(',') + ')';
        find('.currentTrack').style.background = 'linear-gradient(to bottom, rgba(' + uiColors[0].join(',') + ',0) 0%, rgba(' + uiColors[0].join(',') + ',1) 50%)';
        find('.controls').style.backgroundColor = 'rgb(' + uiColors[0].join(',') + ')';
        find('.currentTrack figcaption').style.backgroundColor = 'rgb(' + uiColors[0].join(',') + ')';
        find('.play-pause').style.color = 'rgb(' + uiColors[1].join(',') + ')';
        find('.loaded').style.background = 'rgb(' + uiColors[1].join(',') + ')';
        find('.currentTrackCover').style.background = 'linear-gradient(to bottom, rgba(' + uiColors[0].join(',') + ',0) 0%, rgba(' + uiColors[0].join(',') + ',1) 90%)';

    }

    /* create the background, very light threshold
     * version of the current cover, rest is done via CSS
     * @param src image object
     * @TODO colorized version maybe?
     */
    function createBgImage(src) {
        var image = new CanvasImage(src);
        image.applyFilter('threshold', { min: 100 });;
        find('.bgBox').style.backgroundImage = 'url(' + image.get() + ')';
        image.remove();
    }

    /* Show / Hide playlist
     * using facebook reboundjs for animation
     * @see doPlaylist
     */
    function addEvents() {
        find('.menu-button').addEventListener('click', function () {
            if (document.body.classList.contains('showlist')) {
                scrollAnimation.setEndValue(0);
            } else {
                scrollAnimation.setEndValue(1);
            }
        });
        // due to a strange iOS behavior, the play action has
        // to be separated from anything else, otherwise
        // player won't play at all.
        find('.fa-play').addEventListener('click', function () {
            if (playerLoaded) {
                scPlayer.play();
            }
        });

        find('.fa-pause').addEventListener('click', function () {
            if (scPlayer) {
                scPlayer.pause();
                clearInterval(scTimer);
            }
            this.style.display = 'none';
            find('.fa-play').style.display = 'block';
        });
        doPlaylist();
    }


    function disablePlay() {
        if (!find('.fa-play').classList.contains('loading')) {
            find('.fa-play').className += ' loading';
        }
        playerLoaded = false;
    }

    function enablePlay() {
        find('.fa-play').classList.remove('loading');
        playerLoaded = true;
    }


    /* eventhandling for the playlist
     * - choose track, trigger rebuilding of interface
     * - setting the values for title, image, etc.
     * @TODO build a dynamic playlist via soundcloud API
     */
    function doPlaylist() {
        var size = playlist = findAll('.playlist li');
        itemOnClick = function () {
            currentTrackID = this.getAttribute('data-trackid');
            find('h1').innerHTML = find('strong', this).textContent;
            find('h2').innerHTML = find('span', this).textContent;
            size = getTitleFontSize(find('h2').textContent, find('.controls').getBoundingClientRect().width - 160);
            find('h2').style.fontSize = size + 'px';
            find('.currentTrack img').src = find('img', this).getAttribute('src');
            find('.play-pause').style.top = size / 4 + 'px';
            find('figcaption').innerHTML = find('strong', this).textContent + '<br>' + this.getAttribute('data-album');
            SC.get('/tracks/' + currentTrackID).then(function (track) {
                disablePlay();
                clearInterval(scTimer);
                if (scPlayer) {
                    scPlayer.pause();
                }
                find('.loaded').style.width = 0;
                find('.fa-pause').style.display = 'none';
                find('.fa-play').style.display = 'block';
                currentTrackInfo = track;
                find('.duration').innerHTML = toMMSS(currentTrackInfo.duration);
                find('.played').innerHTML = toMMSS(0);
                doPlay(true);

            });
            scrollAnimation.setEndValue(0);
            buildUI();
        }
        for (var i = 0, l = playlist.length; i < l; i++) {
            playlist[i].addEventListener('click', itemOnClick);
        }
    }

    function toMMSS(raw) {
        var sec_num = Math.round(raw / 1000),
            hours = Math.floor(sec_num / 3600),
            minutes = Math.floor((sec_num - (hours * 3600)) / 60),
            seconds = sec_num - (hours * 3600) - (minutes * 60);
        if (minutes < 10) { minutes = "0" + minutes; }
        if (seconds < 10) { seconds = "0" + seconds; }
        var time = minutes + ':' + seconds;
        return time;
    }

    function doPlay(autoplay) {
        SC.stream('/tracks/' + currentTrackID, { useHTML5Audio: true, preferFlash: false }).then(function (player) {
            scPlayer = player;
            scPlayer.on('play', function () {
                find('.fa-play').style.display = 'none';
                find('.fa-pause').style.display = 'block';
                scTimer = setInterval(doProgress, 1000);
            });
            enablePlay();
            if (!/mobi/i.test(navigator.userAgent)) {
                if (autoplay) {
                    scPlayer.play();
                }
            }
        });
    }

    function doProgress() {
        var tW = find('.controls').getBoundingClientRect().width - 80;
        c = (scPlayer.currentTime() / currentTrackInfo.duration) * 100;
        find('.duration').innerHTML = toMMSS(currentTrackInfo.duration);
        find('.played').innerHTML = toMMSS(scPlayer.currentTime());
        if (scPlayer.currentTime() > currentTrackInfo.duration) {
            clearInterval(timer);
        }
        find('.loaded').style.width = Math.floor(c) + '%';
    }

    /* wrapper for canvas image palette extraction
     * @param src image object
     */
    function getColors(src) {
        var image = new CanvasImage(src),
            colors = image.getColors();
        image.remove();
        return colors;
    }

    /* create the UI
     */
    function buildUI() {
        doExtendedInfo();
        var cImage = find('.currentTrack img'),
            paletteObj, pColor,
            imgObj = new Image(),
            uiColors = detaultColors,
            loadfunc = function () {
                var palette = getColors(this);
                if (palette && palette.length) {
                    palette = ColorUtils.sortColors(palette);

                    // for this layout concept I only use
                    // the 'darkest' and 'lightest' color
                    // of the extracted palette.
                    uiColors[0] = palette[0];
                    uiColors[1] = palette[(palette.length - 1)];

                    // due to the reason that sorting colors
                    // there is a risk that the used sorting by lightness
                    // will return a 'dark' color (by hue) at the highest
                    // rank, therefore reverse if hue test is different
                    if (!ColorUtils.isLightColor(palette[(palette.length - 1)])) {
                        uiColors.reverse();
                        palette.reverse();
                    }
                    // color infos - just to show...
                    paletteObj = document.createElement('ul');
                    paletteObj.className = 'color-palette';
                    for (var i = 0, l = palette.length; i < l; i++) {
                        pColor = document.createElement('li');
                        pColor.style.backgroundColor = 'rgb(' + palette[i].join(',') + ')';
                        paletteObj.appendChild(pColor);
                    }

                    document.body.appendChild(paletteObj);

                    // recolor the interface
                    colorizeUI(uiColors);
                    // update backgroundimage
                    createBgImage(this);
                }
            };
        // set image source and go!
        imgObj.addEventListener('load', loadfunc, false);
        imgObj.src = cImage.getAttribute('src');

    }

    // run....
    return {
        run: function () {
            // init soundcloud
            SC.initialize({
                client_id: soundcloudClientID
            });

            buildUI();
            addEvents();
            // wait for the first track to response...
            SC.get('/tracks/' + currentTrackID).then(function (track) {
                currentTrackInfo = track;
                doPlay(false);
            });
        }
    }
})();

/* Set of color related methods
 * Allows sorting of color palettes by hsl,
 * can detect 'light' or 'dark' colors.
 */
var ColorUtils = (function () {
    var _colorBalance = [0, 0, 0];

    function colorToRGB(colorValue) {
        var r, b, g;
        if (colorValue.constructor === Array) {
            r = colorValue[0];
            g = colorValue[1];
            b = colorValue[2];
        } else if (colorValue.match(/^rgb/)) {
            colorValue = colorValue.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
            r = a[1];
            g = a[2];
            b = a[3];
        } else {
            colorValue = +("0x" + colorValue.slice(1).replace(
                colorValue.length < 5 && /./g, '$&$&'
            )
            );
            r = colorValue >> 16;
            g = colorValue & 255;
            b = colorValue >> 8 & 255;
        }
        return { r: r, g: g, b: b };
    }

    function rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;

        if (max == min) {
            h = s = 0;
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    };

    function colorDistance(color1, color2) {
        var r1 = 0, r2 = 2;
        color1 = rgbToHsl(color1[0], color1[1], color1[2]);
        color2 = rgbToHsl(color2[0], color2[1], color2[2]);


        for (var i = 0; i < 3; i++) {
            r1 += color1[i] * _colorBalance[i];
            r2 += color2[i] * _colorBalance[i];
        }
        return r1 - r2;
    };

    /* Method to decides if a color
     * is light or dark
     */
    function isLightOrDark(colorValue) {
        var rgb = colorToRGB(colorValue);
        hsp = Math.sqrt(
            0.299 * (rgb.r * rgb.r) +
            0.587 * (rgb.g * rgb.g) +
            0.114 * (rgb.b * rgb.b)
        );
        return (hsp > 100.5) ? 'light' : 'dark';
    }
    /* public methods */
    return {
        sortColors: function (colors, balance) {
            balance = balance || [0, 0, 1];
            _colorBalance = balance;
            // per default we sort by lightness...
            // for saturation do: [0,1,0] and for hue [1,0,0]
            // or any other custom balance you want to use...
            return colors.sort(colorDistance);
        },

        isDarkColor: function (colorValue) {
            return (isLightOrDark(colorValue) === 'dark');
        },

        isLightColor: function (colorValue) {
            return (isLightOrDark(colorValue) === 'light');
        },
    }
})();

/*
  canvas Image class
  supports some filters and color extraction.
*/
var CanvasImage = (function () {
    var canvasImage = function (image) {
        this.canvas = document.createElement('canvas');
        this.context = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
        this.width = this.canvas.width = image.width;
        this.height = this.canvas.height = image.height;
        this.context.drawImage(image, 0, 0, this.width, this.height);
    };

    Filter = {
        grayscale: function (imageData, settings) {
            var r, g, b, v, data = imageData.data;
            for (var i = 0, l = data.length; i < l; i += 4) {
                r = data[i];
                g = data[i + 1];
                b = data[i + 2];
                data[i] = data[i + 1] = data[i + 2] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            }
            return imageData;
        },
        threshold: function (imageData, settings) {
            var defaults = { max: 255, min: 0 },
                opts = Object.assign(defaults, settings),
                data = imageData.data;
            for (var i = 0, v, l = data.length; i < l; i += 4) {
                v = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 1] >= 110) ? opts.max : opts.min;
                data[i] = v;
                data[i + 1] = v;
                data[i + 2] = v;
            }
            return imageData;
        }
    };

    canvasImage.prototype = {

        clear: function () {
            this.context.clearRect(0, 0, this.width, this.height);
        },

        remove: function () {
            this.canvas.parentNode.removeChild(this.canvas);
        },

        getPixelAmount: function () {
            return this.width * this.height;
        },

        getImageData: function () {
            return this.context.getImageData(0, 0, this.width, this.height);
        },

        applyFilter: function (filterName, settings) {
            settings = settings || {};
            this.context.putImageData(Filter[filterName](this.getImageData(), settings), 0, 0);
            return this;
        },

        get: function () {
            return this.canvas.toDataURL('image/png');
        },

        getColors: function (settings) {
            var map, arr = [],
                defaults = { quality: 10, colors: 10 },
                opts = Object.assign(defaults, settings),
                data = this.getImageData(),
                pixels = data.data,
                pixelCount = this.getPixelAmount();
            for (var i = 0, offset, r, g, b, a; i < pixelCount; i = i + opts.quality) {
                offset = i * 4;
                r = pixels[offset + 0];
                g = pixels[offset + 1];
                b = pixels[offset + 2];
                a = pixels[offset + 3];
                // color transparent?
                if (a >= 125) {
                    if (!(r > 250 && g > 250 && b > 250)) {
                        arr.push([r, g, b]);
                    }
                }
            }
            map = MMCQ.quantize(arr, opts.colors);
            return ((map) ? map.palette() : null);
        }
    }
    return canvasImage;

})();

/*==================================================================================*/
/*                    third party librarys, methods and logic                       */
/*==================================================================================*/
/*!
 * quantize.js Copyright 2008 Nick Rabinowitz.
 * Licensed under the MIT license: https://www.opensource.org/licenses/mit-license.php
 */

// fill out a couple protovis dependencies
/*!
 * Block below copied from Protovis: https://mbostock.github.com/protovis/
 * Copyright 2010 Stanford Visualization Group
 * Licensed under the BSD License: https://www.opensource.org/licenses/bsd-license.php
 */
if (!pv) {
    var pv = {
        map: function (array, f) {
            var o = {};
            return f ? array.map(function (d, i) { o.index = i; return f.call(o, d); }) : array.slice();
        },
        naturalOrder: function (a, b) {
            return (a < b) ? -1 : ((a > b) ? 1 : 0);
        },
        sum: function (array, f) {
            var o = {};
            return array.reduce(f ? function (p, d, i) { o.index = i; return p + f.call(o, d); } : function (p, d) { return p + d; }, 0);
        },
        max: function (array, f) {
            return Math.max.apply(null, f ? pv.map(array, f) : array);
        }
    };
}

/**
 * Basic Javascript port of the MMCQ (modified median cut quantization)
 * algorithm from the Leptonica library (http://www.leptonica.com/).
 * Returns a color map you can use to map original pixels to the reduced
 * palette. Still a work in progress.
 *
 * @author Nick Rabinowitz
 * @example

// array of pixels as [R,G,B] arrays
var myPixels = [[190,197,190], [202,204,200], [207,214,210], [211,214,211], [205,207,207]
                // etc
                ];
var maxColors = 4;

var cmap = MMCQ.quantize(myPixels, maxColors);
var newPalette = cmap.palette();
var newPixels = myPixels.map(function(p) {
    return cmap.map(p);
});

 */
var MMCQ = (function () {
    // private constants
    var sigbits = 5,
        rshift = 8 - sigbits,
        maxIterations = 1000,
        fractByPopulations = 0.75;

    // get reduced-space color index for a pixel
    function getColorIndex(r, g, b) {
        return (r << (2 * sigbits)) + (g << sigbits) + b;
    }

    // Simple priority queue
    function PQueue(comparator) {
        var contents = [],
            sorted = false;

        function sort() {
            contents.sort(comparator);
            sorted = true;
        }

        return {
            push: function (o) {
                contents.push(o);
                sorted = false;
            },
            peek: function (index) {
                if (!sorted) sort();
                if (index === undefined) index = contents.length - 1;
                return contents[index];
            },
            pop: function () {
                if (!sorted) sort();
                return contents.pop();
            },
            size: function () {
                return contents.length;
            },
            map: function (f) {
                return contents.map(f);
            },
            debug: function () {
                if (!sorted) sort();
                return contents;
            }
        };
    }

    // 3d color space box
    function VBox(r1, r2, g1, g2, b1, b2, histo) {
        var vbox = this;
        vbox.r1 = r1;
        vbox.r2 = r2;
        vbox.g1 = g1;
        vbox.g2 = g2;
        vbox.b1 = b1;
        vbox.b2 = b2;
        vbox.histo = histo;
    }
    VBox.prototype = {
        volume: function (force) {
            var vbox = this;
            if (!vbox._volume || force) {
                vbox._volume = ((vbox.r2 - vbox.r1 + 1) * (vbox.g2 - vbox.g1 + 1) * (vbox.b2 - vbox.b1 + 1));
            }
            return vbox._volume;
        },
        count: function (force) {
            var vbox = this,
                histo = vbox.histo;
            if (!vbox._count_set || force) {
                var npix = 0,
                    i, j, k;
                for (i = vbox.r1; i <= vbox.r2; i++) {
                    for (j = vbox.g1; j <= vbox.g2; j++) {
                        for (k = vbox.b1; k <= vbox.b2; k++) {
                            index = getColorIndex(i, j, k);
                            npix += (histo[index] || 0);
                        }
                    }
                }
                vbox._count = npix;
                vbox._count_set = true;
            }
            return vbox._count;
        },
        copy: function () {
            var vbox = this;
            return new VBox(vbox.r1, vbox.r2, vbox.g1, vbox.g2, vbox.b1, vbox.b2, vbox.histo);
        },
        avg: function (force) {
            var vbox = this,
                histo = vbox.histo;
            if (!vbox._avg || force) {
                var ntot = 0,
                    mult = 1 << (8 - sigbits),
                    rsum = 0,
                    gsum = 0,
                    bsum = 0,
                    hval,
                    i, j, k, histoindex;
                for (i = vbox.r1; i <= vbox.r2; i++) {
                    for (j = vbox.g1; j <= vbox.g2; j++) {
                        for (k = vbox.b1; k <= vbox.b2; k++) {
                            histoindex = getColorIndex(i, j, k);
                            hval = histo[histoindex] || 0;
                            ntot += hval;
                            rsum += (hval * (i + 0.5) * mult);
                            gsum += (hval * (j + 0.5) * mult);
                            bsum += (hval * (k + 0.5) * mult);
                        }
                    }
                }
                if (ntot) {
                    vbox._avg = [~~(rsum / ntot), ~~(gsum / ntot), ~~(bsum / ntot)];
                } else {
                    // console.log('empty box');
                    vbox._avg = [
                        ~~(mult * (vbox.r1 + vbox.r2 + 1) / 2),
                        ~~(mult * (vbox.g1 + vbox.g2 + 1) / 2),
                        ~~(mult * (vbox.b1 + vbox.b2 + 1) / 2)
                    ];
                }
            }
            return vbox._avg;
        },
        contains: function (pixel) {
            var vbox = this,
                rval = pixel[0] >> rshift;
            gval = pixel[1] >> rshift;
            bval = pixel[2] >> rshift;
            return (rval >= vbox.r1 && rval <= vbox.r2 &&
                gval >= vbox.g1 && gval <= vbox.g2 &&
                bval >= vbox.b1 && bval <= vbox.b2);
        }
    };

    // Color map
    function CMap() {
        this.vboxes = new PQueue(function (a, b) {
            return pv.naturalOrder(
                a.vbox.count() * a.vbox.volume(),
                b.vbox.count() * b.vbox.volume()
            );
        });
    }
    CMap.prototype = {
        push: function (vbox) {
            this.vboxes.push({
                vbox: vbox,
                color: vbox.avg()
            });
        },
        palette: function () {
            return this.vboxes.map(function (vb) { return vb.color; });
        },
        size: function () {
            return this.vboxes.size();
        },
        map: function (color) {
            var vboxes = this.vboxes;
            for (var i = 0; i < vboxes.size(); i++) {
                if (vboxes.peek(i).vbox.contains(color)) {
                    return vboxes.peek(i).color;
                }
            }
            return this.nearest(color);
        },
        nearest: function (color) {
            var vboxes = this.vboxes,
                d1, d2, pColor;
            for (var i = 0; i < vboxes.size(); i++) {
                d2 = Math.sqrt(
                    Math.pow(color[0] - vboxes.peek(i).color[0], 2) +
                    Math.pow(color[1] - vboxes.peek(i).color[1], 2) +
                    Math.pow(color[2] - vboxes.peek(i).color[2], 2)
                );
                if (d2 < d1 || d1 === undefined) {
                    d1 = d2;
                    pColor = vboxes.peek(i).color;
                }
            }
            return pColor;
        },
        forcebw: function () {
            // XXX: won't  work yet
            var vboxes = this.vboxes;
            vboxes.sort(function (a, b) { return pv.naturalOrder(pv.sum(a.color), pv.sum(b.color)); });

            // force darkest color to black if everything < 5
            var lowest = vboxes[0].color;
            if (lowest[0] < 5 && lowest[1] < 5 && lowest[2] < 5)
                vboxes[0].color = [0, 0, 0];

            // force lightest color to white if everything > 251
            var idx = vboxes.length - 1,
                highest = vboxes[idx].color;
            if (highest[0] > 251 && highest[1] > 251 && highest[2] > 251)
                vboxes[idx].color = [255, 255, 255];
        }
    };

    // histo (1-d array, giving the number of pixels in
    // each quantized region of color space), or null on error
    function getHisto(pixels) {
        var histosize = 1 << (3 * sigbits),
            histo = new Array(histosize),
            index, rval, gval, bval;
        pixels.forEach(function (pixel) {
            rval = pixel[0] >> rshift;
            gval = pixel[1] >> rshift;
            bval = pixel[2] >> rshift;
            index = getColorIndex(rval, gval, bval);
            histo[index] = (histo[index] || 0) + 1;
        });
        return histo;
    }

    function vboxFromPixels(pixels, histo) {
        var rmin = 1000000, rmax = 0,
            gmin = 1000000, gmax = 0,
            bmin = 1000000, bmax = 0,
            rval, gval, bval;
        // find min/max
        pixels.forEach(function (pixel) {
            rval = pixel[0] >> rshift;
            gval = pixel[1] >> rshift;
            bval = pixel[2] >> rshift;
            if (rval < rmin) rmin = rval;
            else if (rval > rmax) rmax = rval;
            if (gval < gmin) gmin = gval;
            else if (gval > gmax) gmax = gval;
            if (bval < bmin) bmin = bval;
            else if (bval > bmax) bmax = bval;
        });
        return new VBox(rmin, rmax, gmin, gmax, bmin, bmax, histo);
    }

    function medianCutApply(histo, vbox) {
        if (!vbox.count()) return;

        var rw = vbox.r2 - vbox.r1 + 1,
            gw = vbox.g2 - vbox.g1 + 1,
            bw = vbox.b2 - vbox.b1 + 1,
            maxw = pv.max([rw, gw, bw]);
        // only one pixel, no split
        if (vbox.count() == 1) {
            return [vbox.copy()];
        }
        /* Find the partial sum arrays along the selected axis. */
        var total = 0,
            partialsum = [],
            lookaheadsum = [],
            i, j, k, sum, index;
        if (maxw == rw) {
            for (i = vbox.r1; i <= vbox.r2; i++) {
                sum = 0;
                for (j = vbox.g1; j <= vbox.g2; j++) {
                    for (k = vbox.b1; k <= vbox.b2; k++) {
                        index = getColorIndex(i, j, k);
                        sum += (histo[index] || 0);
                    }
                }
                total += sum;
                partialsum[i] = total;
            }
        }
        else if (maxw == gw) {
            for (i = vbox.g1; i <= vbox.g2; i++) {
                sum = 0;
                for (j = vbox.r1; j <= vbox.r2; j++) {
                    for (k = vbox.b1; k <= vbox.b2; k++) {
                        index = getColorIndex(j, i, k);
                        sum += (histo[index] || 0);
                    }
                }
                total += sum;
                partialsum[i] = total;
            }
        }
        else {  /* maxw == bw */
            for (i = vbox.b1; i <= vbox.b2; i++) {
                sum = 0;
                for (j = vbox.r1; j <= vbox.r2; j++) {
                    for (k = vbox.g1; k <= vbox.g2; k++) {
                        index = getColorIndex(j, k, i);
                        sum += (histo[index] || 0);
                    }
                }
                total += sum;
                partialsum[i] = total;
            }
        }
        partialsum.forEach(function (d, i) {
            lookaheadsum[i] = total - d;
        });
        function doCut(color) {
            var dim1 = color + '1',
                dim2 = color + '2',
                left, right, vbox1, vbox2, d2, count2 = 0;
            for (i = vbox[dim1]; i <= vbox[dim2]; i++) {
                if (partialsum[i] > total / 2) {
                    vbox1 = vbox.copy();
                    vbox2 = vbox.copy();
                    left = i - vbox[dim1];
                    right = vbox[dim2] - i;
                    if (left <= right)
                        d2 = Math.min(vbox[dim2] - 1, ~~(i + right / 2));
                    else d2 = Math.max(vbox[dim1], ~~(i - 1 - left / 2));
                    // avoid 0-count boxes
                    while (!partialsum[d2]) d2++;
                    count2 = lookaheadsum[d2];
                    while (!count2 && partialsum[d2 - 1]) count2 = lookaheadsum[--d2];
                    // set dimensions
                    vbox1[dim2] = d2;
                    vbox2[dim1] = vbox1[dim2] + 1;
                    // console.log('vbox counts:', vbox.count(), vbox1.count(), vbox2.count());
                    return [vbox1, vbox2];
                }
            }

        }
        // determine the cut planes
        return maxw == rw ? doCut('r') :
            maxw == gw ? doCut('g') :
                doCut('b');
    }

    function quantize(pixels, maxcolors) {
        // short-circuit
        if (!pixels.length || maxcolors < 2 || maxcolors > 256) {
            //            console.log('wrong number of maxcolors');
            return false;
        }

        // XXX: check color content and convert to grayscale if insufficient

        var histo = getHisto(pixels),
            histosize = 1 << (3 * sigbits);

        // check that we aren't below maxcolors already
        var nColors = 0;
        histo.forEach(function () { nColors++; });
        if (nColors <= maxcolors) {
            // XXX: generate the new colors from the histo and return
        }

        // get the beginning vbox from the colors
        var vbox = vboxFromPixels(pixels, histo),
            pq = new PQueue(function (a, b) { return pv.naturalOrder(a.count(), b.count()); });
        pq.push(vbox);

        // inner function to do the iteration
        function iter(lh, target) {
            var ncolors = 1,
                niters = 0,
                vbox;
            while (niters < maxIterations) {
                vbox = lh.pop();
                if (!vbox.count()) { /* just put it back */
                    lh.push(vbox);
                    niters++;
                    continue;
                }
                // do the cut
                var vboxes = medianCutApply(histo, vbox),
                    vbox1 = vboxes[0],
                    vbox2 = vboxes[1];

                if (!vbox1) {
                    // console.log("vbox1 not defined; shouldn't happen!");
                    return;
                }
                lh.push(vbox1);
                if (vbox2) {  /* vbox2 can be null */
                    lh.push(vbox2);
                    ncolors++;
                }
                if (ncolors >= target) return;
                if (niters++ > maxIterations) {
                    // console.log("infinite loop; perhaps too few pixels!");
                    return;
                }
            }
        }

        // first set of colors, sorted by population
        iter(pq, fractByPopulations * maxcolors);

        // Re-sort by the product of pixel occupancy times the size in color space.
        var pq2 = new PQueue(function (a, b) {
            return pv.naturalOrder(a.count() * a.volume(), b.count() * b.volume());
        });
        while (pq.size()) {
            pq2.push(pq.pop());
        }

        // next set - generate the median cuts using the (npix * vol) sorting.
        iter(pq2, maxcolors - pq2.size());

        // calculate the actual colors
        var cmap = new CMap();
        while (pq2.size()) {
            cmap.push(pq2.pop());
        }
        return cmap;
    }

    return {
        quantize: quantize
    };
})();


// here we go....
document.addEventListener('DOMContentLoaded', function () { ui.run(); }, false);
