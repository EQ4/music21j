/**
 * music21j -- Javascript reimplementation of Core music21 features.  
 * music21/duration -- duration routines
 *
 * Copyright (c) 2013-14, Michael Scott Cuthbert and cuthbertLab
 * Based on music21, Copyright (c) 2006-14, Michael Scott Cuthbert and cuthbertLab
 * 
 */

define(['./common', './prebase', 'jquery'],
        /**
         * Duration module. See {@link music21.duration}
         * 
         * @requires music21/common
         * @requires music21/prebase
         * @exports music21/duration
         */
        function(common, prebase, $) {
    /** 
     * Module that holds **music21** classes and
     * tools for dealing with durations, especially
     * the {@link music21.duration.Duration} class.
     * 
     * @namespace music21.duration 
     * @memberof music21
     */
	var duration = {};

	/**
	 * Object mapping int to name, as in `{1: 'whole'}` etc.
	 * 
	 * @memberof music21.duration
	 * @type {object}
	 */
	duration.typeFromNumDict = {
	        1: 'whole',
	        2: 'half',
	        4: 'quarter',
	        8: 'eighth',
	        16: '16th',
	        32: '32nd',
	        64: '64th',
	        128: '128th',
	        256: '256th',
	        512: '512th',
	        1024: '1024th',
	        0: 'zero',
	        '0.5': 'breve',
	        '0.25': 'longa',
	        '0.125': 'maxima',
	        '0.0625': 'duplex-maxima',
	};
	duration.quarterTypeIndex = 6; // where is quarter in the following array.
	duration.ordinalTypeFromNum = ['duplex-maxima','maxima','longa','breve','whole','half','quarter','eighth','16th','32nd','64th','128th', '256th', '512th', '1024th'];
	duration.vexflowDurationArray = [undefined, undefined, undefined, undefined, 'w', 'h', 'q', '8', '16', '32', undefined, undefined, undefined, undefined, undefined];
	
	/**
	 * Duration object; found as the `.duration` attribute on {@link music21.base.Music21Object} instances
	 * such as {@link music21.note.Note}
	 * 
	 * @class Duration
	 * @memberof music21.duration
	 * @extends music21.prebase.ProtoM21Object
	 * @param {(number|undefined)} ql - quarterLength (default 1.0)
	 */
	duration.Duration = function (ql) {
	    prebase.ProtoM21Object.call(this, ql);
	    this.classes.push('Duration');
	    this._quarterLength = 1.0;
	    this._dots = 0;
		this._durationNumber = undefined;
		this._type = 'quarter';
		this._tuplets = [];
		
        this._cloneCallbacks._tuplets = function (tupletKey, ret, obj) {
            // make sure that tuplets clone properly
            var newTuplets = [];
            for (var i = 0; i < obj[tupletKey].length; i++) {
                var newTuplet = obj[tupletKey][i].clone();
                //console.log('cloning tuplets', obj[tupletKey][i], newTuplet);
                newTuplets.push(newTuplet);
            }
            ret[tupletKey] = newTuplets;
        };
	    Object.defineProperties(this, {
	    	/**
	    	 * Read or sets the number of dots on the duration.
	    	 * 
	    	 * Updates the quarterLength
	    	 * 
	    	 * @type Number
	    	 * @instance
	    	 * @default 0
	    	 * @memberof music21.duration.Duration
	    	 * @example
	    	 * var d = new music21.duration.Duration(2);
	    	 * d.dots === 0; // true
	    	 * d.dots = 1; 
	    	 * d.quarterLength == 3; // true;
	    	 */
	        'dots': { 
	    		get: function () { 
			       		return this._dots;
	    			},
	    		set: function (numDots) {
                    this._dots = numDots;
                    this.updateQlFromFeatures();
	    		}
	    	},
            /**
             * Read or sets the quarterLength of the Duration
             * 
             * Updates the type, dots, tuplets(?)
             * 
             * @type Number
             * @instance
             * @default 1.0
             * @memberof music21.duration.Duration
             * @example
             * var d = new music21.duration.Duration(2);
             * d.quarterLength == 2.0; // true;
             * d.quarterLength = 1.75;
             * d.dots == 2; // true
             * d.type == 'quarter'; // true
             */
	    	'quarterLength': {
				get: function () {
					return this._quarterLength;
				},
				set: function (ql) {
					if (ql === undefined) {
						ql = 1.0;
					}
					this._quarterLength = ql;
					this.updateFeaturesFromQl();
				}
			},
	         /**
             * Read or sets the type of the duration.
             * 
             * Updates the quarterLength
             * 
             * @type String
             * @instance
             * @default 'quarter'
             * @memberof music21.duration.Duration
             * @example
             * var d = new music21.duration.Duration(2);
             * d.type == 'half; // true
             * d.type = 'breve';
             * d.quarterLength == 8.0; // true
             * d.dots = 1;
             * d.type = 'quarter'; // will not change dots
             * d.quarterLength == 1.5; // true
             */
			'type': {
				get: function () {
					return this._type;
				},
				set: function (typeIn) {
					var typeNumber = $.inArray(typeIn, duration.ordinalTypeFromNum);
					if (typeNumber == -1) {
						console.log('invalid type ' + typeIn);
                        throw('invalid type ' + typeIn);
					}
                    this._type = typeIn;
					this.updateQlFromFeatures();
				}
			},
            /**
             * Reads the tuplet Array for the duration.
             * 
             * The tuplet array should be considered Read Only.
             * Use {@link music21.duration.Duration#appendTuplet} to
             * add a tuplet (no way to remove yet)
             * 
             * @type Array<music21.duration.Tuplet>
             * @instance
             * @default []
             * @memberof music21.duration.Duration
             */
			'tuplets' : {
			    enumerable: true,
			    get: function () { return this._tuplets; }
			},
            /**
             * Read-only: the duration expressed for VexFlow
             * 
             * @type String
             * @instance
             * @default 'd'
             * @memberof music21.duration.Duration
             * @example
             * var d = new music21.duration.Duration(2);
             * d.vexflowDuration == 'h'; // true;
             * d.dots = 2;
             * d.vexflowDuration == 'hdd'; // true;
             */
			'vexflowDuration': {
				get: function() {
		            var typeNumber = $.inArray(this.type, duration.ordinalTypeFromNum);
					var vd = duration.vexflowDurationArray[typeNumber];
					if (this.dots > 0) {
					    for (var i = 0; i < this.dots; i++) {
	                        vd += "d"; // vexflow does not handle double dots .. or does it???
					    }
					}
					return vd;
				}
			}
		});
		

	    if (typeof(ql) == 'string') {
	    	this.type = ql;
	    } else {
	    	this.quarterLength = ql;
	    }
	    //alert(ql + " " + this.type + " " + this.dots);
	};
    duration.Duration.prototype = new prebase.ProtoM21Object();
    duration.Duration.prototype.constructor = duration.Duration;
    duration.Duration.prototype._findDots = function (ql) {
        if (ql === 0) { return 0; } // zero length stream probably;
        var typeNumber = $.inArray(this._type, duration.ordinalTypeFromNum);
        var powerOfTwo = Math.pow(2, duration.quarterTypeIndex - typeNumber);
        // alert(undottedQL * 1.5 + " " + ql)
        //console.log('find dots called on ql: ', ql, typeNumber, powerOfTwo);
        for (var dotsNum = 0; dotsNum <= 4; dotsNum++) {
            var dotMultiplier = (Math.pow(2, dotsNum) - 1.0)/(Math.pow(2, dotsNum));
            var durationMultiplier = 1 + dotMultiplier;
            if (Math.abs((powerOfTwo * durationMultiplier) - ql) < 0.0001) {
                return dotsNum;
            }
        }
        if (music21.debug) {
            console.log('no dots available for ql; probably a tuplet', ql);
        }
        return 0;
    };
    duration.Duration.prototype.updateQlFromFeatures = function () {
        var typeNumber = $.inArray(this._type, duration.ordinalTypeFromNum); // must be set property
        var undottedQuarterLength = Math.pow(2, duration.quarterTypeIndex - typeNumber);
        var dottedMultiplier = 1 + ((Math.pow(2, this._dots) - 1) / Math.pow(2, this._dots));
        var unTupletedQl = undottedQuarterLength * dottedMultiplier;
        var tupletCorrectedQl = unTupletedQl;
        this._tuplets.forEach( function(tuplet) {
            tupletCorrectedQl *= tuplet.tupletMultiplier();
        });
        this._quarterLength = tupletCorrectedQl;
    };

    duration.Duration.prototype.updateFeaturesFromQl = function () {
        var ql = this._quarterLength;
        var powerOfTwo = Math.floor(Math.log(ql + 0.00001)/Math.log(2));
        var typeNumber = duration.quarterTypeIndex - powerOfTwo;
        this._type = duration.ordinalTypeFromNum[typeNumber];
        //alert(this._findDots);
        this._dots = this._findDots(ql);

        var undottedQuarterLength = Math.pow(2, duration.quarterTypeIndex - typeNumber);
        var dottedMultiplier = 1 + ( (Math.pow(2, this._dots) - 1) / Math.pow(2, this._dots) );
        var unTupletedQl = undottedQuarterLength * dottedMultiplier;
        if (unTupletedQl != ql && ql != 0) {
            typeNumber -= 1;
            this._type = duration.ordinalTypeFromNum[typeNumber]; // increase type: eighth to quarter etc.
            unTupletedQl = unTupletedQl * 2;
            var tupletRatio = ql/unTupletedQl;
            var ratioRat = common.rationalize(tupletRatio);
            if (ratioRat === undefined) {
                // probably a Stream with a length that is inexpressable;
            } else {
                var t = new duration.Tuplet(ratioRat.denominator, ratioRat.numerator, new duration.Duration(unTupletedQl));
                this.appendTuplet(t, true); // skipUpdateQl                    
            }
            //console.log(ratioRat, ql, unTupletedQl);
        }
    };
    
    /**
     * Add a tuplet to music21j
     * 
     * @memberof music21.duration.Duration
     * @param {music21.duration.Tuplet} newTuplet - tuplet to add to `.tuplets`
     * @param {boolean} [skipUpdateQl=false] - update the quarterLength afterwards?
     */
    duration.Duration.prototype.appendTuplet = function (newTuplet, skipUpdateQl) {
        newTuplet.frozen = true;
        this._tuplets.push(newTuplet);
        if (skipUpdateQl !== true) {
            this.updateQlFromFeatures();                
        }
    };

    
    /**
     * Represents a Tuplet; found in {@link music21.duration.Duration#tuplets}
     * 
     * @class Tuplet
     * @memberof music21.duration
     * @extends music21.prebase.ProtoM21Object
     * @param {number} numberNotesActual - numerator of the tuplet, default 3
     * @param {number} numberNotesNormal - denominator of the tuplet, default 2
     * @param {(music21.duration.Duration|number)} durationActual - duration or quarterLength of duration type, default music21.duration.Duration(0.5)
     * @param {(music21.duration.Duration|number)} durationNormal - unused; see music21p for description
     */
	duration.Tuplet = function (numberNotesActual, numberNotesNormal, 
	        durationActual, durationNormal) {
	    prebase.ProtoM21Object.call(this);
	    this.classes.push('Tuplet');
	    this.numberNotesActual = numberNotesActual || 3;
	    this.numberNotesNormal = numberNotesNormal || 2;
	    this.durationActual = durationActual || new duration.Duration(0.5);
	    if (typeof(this.durationActual) == 'number') {
	        this.durationActual = new duration.Duration(this.durationActual);
	    }
	    this.durationNormal = durationNormal || this.durationActual;
	    
	    this.frozen = false;
	    this.type = undefined;

	    /**
	     * Show a bracket above the tuplet
	     * 
	     * @memberof music21.duration.Tuplet#
	     * @member {Boolean} bracket
	     * @default true
	     */
	    this.bracket = true;
        /**
         * Bracket placement. Options are `above` or `below`.
         * 
         * @memberof music21.duration.Tuplet#
         * @member {String} placement
         * @default 'above'
         */
	    this.placement = 'above';

	    /**
         * What to show above the Tuplet. Options are `number`, `type`, or (string) `none`.
         * 
         * @memberof music21.duration.Tuplet#
         * @member {String} tupletActualShow
         * @default 'number'
         */
        this.tupletActualShow = 'number';
	    this.tupletNormalShow = undefined; // undefined, 'ratio' for ratios, 'type' for ratioed notes (does not work)
	    
	    Object.defineProperties(this, {
            /**
             * A nice name for the tuplet.
             * 
             * @type String
             * @instance
             * @readonly
             * @memberof music21.duration.Tuplet
             */
	       'fullName': {
	           enumerable: true,
	           get: function () {
	               // actual is what is presented to viewer
	               var numActual = this.numberNotesActual;
	               var numNormal = this.numberNotesNormal;
	               
	               if (numActual == 3 && numNormal == 2) {
                       return 'Triplet';	                   
	               } else if (numActual == 5 && (numNormal == 4 || numNormal == 2)) {
	                   return 'Quintuplet';
	               } else if (numActual == 6 && numNormal == 4) {
	                   return 'Sextuplet';
	               }
	               ordStr = common.ordinalAbbreviation(numNormal, true); // plural
	               return 'Tuplet of ' + numActual.toString() + '/' + numNormal.toString() + ordStr;
	           },
	       },
	    });
	    
	};
    duration.Tuplet.prototype = new prebase.ProtoM21Object();
    duration.Tuplet.prototype.constructor = duration.Tuplet;

    /**
     * Set both durationActual and durationNormal for the tuplet.
     * 
     * @memberof music21.duration.Tuplet
     * @param {string} type - a duration type, such as `half`, `quarter`
     * @returns {music21.duration.Duration} A converted {@link music21.duration.Duration} matching `type` 
     */    
    duration.Tuplet.prototype.setDurationType = function (type) {
        if (self.frozen === true) {
            throw ("A frozen tuplet (or one attached to a duration) is immutable");    
        }
        this.durationActual = new duration.Duration(type);
        this.durationNormal = this.durationActual;
        return this.durationActual;
    };
    /**
     * Sets the tuplet ratio.
     * 
     * @memberof music21.duration.Tuplet
     * @param {Number} actual - number of notes in actual (e.g., 3)
     * @param {Number} normal - number of notes in normal (e.g., 2)
     * @returns {undefined}
     */
    duration.Tuplet.prototype.setRatio = function (actual, normal) {
        if (self.frozen === true) {
            throw ("A frozen tuplet (or one attached to a duration) is immutable");    
        }
        this.numberNotesActual = actual || 3;
        this.numberNotesNormal = normal || 2;
    };
    
    /**
     * Get the quarterLength corresponding to the total length that
     * the completed tuplet (i.e., 3 notes in a triplet) would occupy.
     * 
     * @memberof music21.duration.Tuplet
     * @returns {Number} A quarter length.
     */
    duration.Tuplet.prototype.totalTupletLength = function () {
        return this.numberNotesNormal * this.durationNormal.quarterLength;
    };
    /**
     * The amount by which each quarter length is multiplied to get
     * the tuplet. For instance, in a normal triplet, this is 0.666
     * 
     * @memberof music21.duration.Tuplet
     * @returns {Number} A float of the multiplier
     */
    duration.Tuplet.prototype.tupletMultiplier = function () {
        var lengthActual = this.durationActual.quarterLength;
        return (this.totalTupletLength() / (
                this.numberNotesActual * lengthActual));
    };

	duration.tests = function () {
	    test( "music21.duration.Duration", function () {
	        var d = new music21.duration.Duration(1.0);
	        equal(d.type, 'quarter', 'got quarter note from 1.0');
	        equal(d.dots, 0, 'got no dots');
	        equal(d.quarterLength, 1.0, 'got 1.0 from 1.0');
            equal(d.vexflowDuration, 'q', 'vexflow q');
            d.type = 'half';
            equal(d.type, 'half', 'got half note from half');
            equal(d.dots, 0, 'got no dots');
            equal(d.quarterLength, 2.0, 'got 2.0 from half');
            equal(d.vexflowDuration, 'h', 'vexflow h');
            d.quarterLength = 6.0;
            equal(d.type, 'whole');
            equal(d.dots, 1, 'got one dot from 6.0');
            equal(d.quarterLength, 6.0, 'got 6.0');
            equal(d.vexflowDuration, 'wd', 'vexflow duration wd');
            d.quarterLength = 7.75;
            equal(d.type, 'whole');
            equal(d.dots, 4, 'got four dots from 7.75');
	    });

	    test( "music21.duration.Tuplet", function () { 
            var d = new music21.duration.Duration(0.5);
            var t = new music21.duration.Tuplet(5, 4);
            equal(t.tupletMultiplier(), 0.8, 'tuplet multiplier');
            d.appendTuplet(t);
            equal(t.frozen, true, 'tuplet is frozen');
            equal(d._tuplets[0], t, 'tuplet appended');
            equal(d.quarterLength, 0.4, 'quarterLength Updated');
            
            
            var d2 = new music21.duration.Duration(1/3);
            equal(d2.type, 'eighth', 'got eighth note from 1/3');
            equal(d2.dots, 0, 'got no dots');
            equal(d2.quarterLength, 1/3, 'got 1/3 from 1/3');
            var t2 = d2.tuplets[0];
            equal(t2.numberNotesActual, 3, '3/2 tuplet');
            equal(t2.numberNotesNormal, 2, '3/2 tuplet');
            equal(t2.durationActual.quarterLength, 0.5);
            equal(t2.tupletMultiplier(), 2/3, '2/3 tuplet multiplier');
            equal(t2.totalTupletLength(), 1.0, 'total tuplet == 1.0');
            
            var s = new music21.stream.Stream();
            s.timeSignature = new music21.meter.TimeSignature('2/2');
            for (var i = 0; i < 6; i++) {
                var n1 = new music21.note.Note('C4');
                n1.duration.quarterLength = 2/3;
                if (i % 3 === 0) {
                    n1.articulations.push( new music21.articulations.Accent() );
                }
                s.append(n1);
            }
            s.appendNewCanvas();
            ok(true, 'quarter note triplets displayed');
            
            
            var m6 = new music21.stream.Measure();
            m6.renderOptions.staffLines = 1;
            m6.timeSignature = new music21.meter.TimeSignature('2/4');
            var n6 = new music21.note.Note('B4');
            n6.duration.quarterLength = 2/3;
            n6.duration.tuplets[0].durationNormal.type = 'eighth';
            n6.duration.tuplets[0].tupletNormalShow = 'ratio';
            
            var n7 = new music21.note.Note('B4');
            n7.duration.quarterLength = 1/3;
            n7.duration.tuplets[0].tupletNormalShow = 'ratio';

            m6.append(n6);
            m6.append(n7);
            m6.append(n7.clone());
            var n6clone = n6.clone();
            m6.append(n6clone);
            m6.appendNewCanvas();
            ok(true, 'tuplets beginning with different type than original');
            equal(n6.duration.tuplets[0] !== n6clone.duration.tuplets[0], true, 'tuplet should not be the same object after clone');
	    });
        test( "music21.duration.Tuplet multiple parts", function () { 
            var s2 = new music21.stream.Measure();
            s2.timeSignature = new music21.meter.TimeSignature('3/2');
            var na1 = new music21.note.Note('F4');
            var na2 = new music21.note.Note('E4');
            s2.append(na1);
            s2.append(na2);
            for (var i = 0; i < 10; i++) {
                var n1 = new music21.note.Note('F4');
                n1.pitch.diatonicNoteNum += i;
                n1.duration.quarterLength = 2/5;
                n1.duration.tuplets[0].tupletNormalShow = 'ratio';
                if (i % 5 === 0) {
                    n1.articulations.push( new music21.articulations.Accent() );
                }
                s2.append(n1);
            }
            var s3 = new music21.stream.Measure();
            s3.timeSignature = new music21.meter.TimeSignature('3/2');
            s3.append( new music21.note.Note("B5", 6.0));
            var p = new music21.stream.Part();
            p.append(s2);
            p.append(s3);
            
            var m4 = new music21.stream.Measure();
            m4.timeSignature = new music21.meter.TimeSignature('3/2');
            m4.append( new music21.note.Note("B3", 6.0));
            var m5 = new music21.stream.Measure();
            m5.timeSignature = new music21.meter.TimeSignature('3/2');
            m5.append( new music21.note.Note("B3", 6.0));
            var p2 = new music21.stream.Part();
            p2.append(m4);
            p2.append(m5);
        
            var sc = new music21.stream.Score();
            sc.insert(0, p);
            sc.insert(0, p2);
            sc.appendNewCanvas();
            ok(true, '5:4 tuplets in 3/2 with multiple parts');            
        });
	};
	
	// end of define
	if (typeof(music21) != "undefined") {
		music21.duration = duration;
	}
	return duration;	
});
