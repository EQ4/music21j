/**
 * music21j -- Javascript reimplementation of Core music21p features.  
 * music21/webmidi -- webmidi or wrapper around the Jazz Plugin
 * 
 * For non webmidi --  Uses the cross-platform, cross-browser plugin from 
 * http://jazz-soft.net/doc/Jazz-Plugin/Plugin.html
 * P.S. by the standards of divinity of most major religions, Sema Kachalo is a god.
 *
 * Copyright (c) 2014-15, Michael Scott Cuthbert and cuthbertLab
 * Based on music21 (=music21p), Copyright (c) 2006–15, Michael Scott Cuthbert and cuthbertLab
 * 
 */

define(['./miditools','./common','jquery'], 
        /**
         * webmidi -- for connecting with external midi devices
         * 
         * Uses either the webmidi API or the Jazz plugin
         * 
         * See {@link music21.webmidi}
         * 
         * @exports music21/webmidi
         */
        function(miditools, common, $) {
    /**
     * webmidi -- for connecting with external midi devices
     * 
     * Uses either the webmidi API or the Jazz plugin
     * 
     * @namespace music21.webmidi
     * @memberof music21
     * @requires music21/miditools
     * @requires jquery
     * @property {JazzObject|undefined} storedPlugin - reference to the Jazz object from the plugin; cached from `createPlugin`.
     * @property {string} selectedJazzInterface - the currently connected interface (note that we can only use one right now)
     */
    var webmidi = {};
    webmidi.selectedOutputPort = undefined;
    webmidi.selectedInputPort = undefined;
    
    webmidi.access = undefined;
    webmidi.$selectDiv = undefined;
    
    
    webmidi.jazzDownloadUrl = 'http://jazz-soft.net/download/Jazz-Plugin/';
	webmidi.storedPlugin = undefined;
	webmidi.selectedJazzInterface = undefined; // not the same as "" etc. uses last selected interface by default.
    
    /* ----------- callbacks --------- */
	// todo: all callbacks (incl. raw, sendOutChord) should be able to be a function or an array of functions
	/**
	 * callBacks is an object with three keys:
	 * 
	 * - raw: function (t, a, b,c) to call when any midievent arrives. Default: `function (t, a, b, c) { return new miditools.Event(t, a, b, c); }`
	 * - general: function ( miditools.Event() ) to call when an Event object has been created. Default: `[miditools.sendToMIDIjs, miditools.quantizeLastNote]`
	 * - sendOutChord: function (array_of_note.Note_objects) to call when a sufficient time has passed to build a chord from input. Default: empty function.
     *
     * At present, only "general" can take an Array of event listening functions, but I hope to change that for sendOutChord also.
     *
     * "general" is usually the callback list to play around with.
     *
	 * @memberof music21.webmidi
	 */
    webmidi.callBacks = {
        raw : function (t, a, b, c) { return new miditools.Event(t, a, b, c); },
        general : [miditools.sendToMIDIjs,
                   miditools.quantizeLastNote],        
        sendOutChord : function (arrayOfNotes) { },
    };

    /**
     * Called by Jazz MIDI plugin when an event arrives.
     * 
     * Shim to convert the data into WebMIDI API format and then call the WebMIDI API midiInArrived
     * 
     * See the MIDI spec for information on parameters
     * 
     * @memberof music21.webmidi
     * @param {byte} t - timing information
     * @param {byte} a - data 1 
     * @param {byte} b - data 2
     * @param {byte} c - data 3 
     */
    webmidi.jazzMidiInArrived =  function (t, a, b, c) {
        var webmidiEvent = {
                timestamp: t,
                data: [a, b, c]
        };
        return webmidi.midiInArrived(webmidiEvent);
    };    
    
    
    
    /**
     * Called directly when a MIDI event arrives from the WebMIDI API, or via a Shim (jazzMidiInArrived)
     * when MIDI information comes from JazzMIDI
     * 
     * Calls the 'raw' and 'general callbacks when a raw midi event (four bytes)
     * arrives.
     * 
     * See the MIDI spec for information on the contents of the three parameters.
     * 
     * midiMessageEvent should be an object with two keys: timeStamp (int) and data (array of three int values)
     * 
     * @memberof music21.webmidi
     * @param {MidiMessageEvent} midiMessageEvent - midi Information
     */
	webmidi.midiInArrived = function (midiMessageEvent) {
	    t = midiMessageEvent.timeStamp;
	    a = midiMessageEvent.data[0];
        b = midiMessageEvent.data[1];
        c = midiMessageEvent.data[2];
	    var eventObject = webmidi.callBacks.raw(t, a, b, c);
	    if (webmidi.callBacks.general instanceof Array) {
	        webmidi.callBacks.general.forEach( function(el, index, array) { 
	            el(eventObject);  
	        });
	    } else if (webmidi.callBacks.general !== undefined) {
	        return webmidi.callBacks.general(eventObject);
	    }
	};
	
    /**
     * Create a hidden tiny, &lt;object&gt; tag in the DOM with the
     * proper classid (`CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90`) to
     * load the Jazz plugin.
     * 
     * It will return the plugin if it can or undefined if it cannot. Caches it in webmidi.storedPlugin.
     * 
     * @function music21.webmidi.createPlugin
     * @param {DOMObject} [appendElement=document.body] - where to place this hidden object (does not really matter)
     * @param {Boolean} [override=false] - if this method has been called successfully before return the storedPlugin unless override is true.  
     * @returns {Jazz|undefined} Jazz MIDI plugin object
     */
	webmidi.createPlugin = function (appendElement, override) {
        if ((webmidi.storedPlugin) && (override != true)) { 
            return webmidi.storedPlugin;
        }
        if (typeof(appendElement) == 'undefined') {
            appendElement = $('body')[0];
        } 
        var obj = document.createElement('object');
        obj.classid = "CLSID:1ACE1618-1C7D-4561-AEE1-34842AA85E90";
        if (!obj.isJazz) {
            obj.type = "audio/x-jazz";
        }
        obj.style.visibility = 'hidden';
        obj.style.width = '0px'; 
        obj.style.height = '0px';
        appendElement.appendChild(obj);

        if (obj.isJazz) {
            webmidi.storedPlugin = obj;
            return obj;
        } else {
            appendElement.removeChild(obj);
            console.error("Cannot use jazz plugin; install at " + webmidi.jazzDownloadUrl);
            return undefined;
        }
    };

    /**
     * Creates a &lt;select&gt; object for selecting among the MIDI choices in Jazz
     * 
     * @function music21.webmidi.createJazzSelector
     * @param {JQueryDOMObject|DOMObject} [midiSelectDiv=document.body] - object to append the select to
     * @param {object} [options] - see createSelector for details
     * @returns {DOMObject|undefined} DOM object containing the select tag, or undefined if Jazz cannot be loaded.
     */
    webmidi.createJazzSelector = function ($newSelect, options) {
        params = {};
        common.merge(params, options);
        
        var Jazz = webmidi.createPlugin();
        if (Jazz === undefined) {
            return undefined;
        }

        $newSelect.change( function () { 
            var selectedInput = $("#midiInSelect option:selected").text();
            if (selectedInput != "None selected") {
                webmidi.selectedJazzInterface = Jazz.MidiInOpen(selectedInput, webmidi.jazzMidiInArrived);                
            } else {
                Jazz.MidiInClose();
            }
            if (music21.debug) {
                console.log("current input changed to: " + webmidi.selectedInterface);
            }
        });
        var midiOptions = Jazz.MidiInList();
        var noneAppendOption = $("<option value='None'>None selected</option>");
        $newSelect.append(noneAppendOption);
        
        var anySelected = false;
        var allAppendOptions = [];
        for (var i = 0; i < midiOptions.length; i++) {
            var $appendOption = $("<option value='" + midiOptions[i] + "'>" + midiOptions[i] + "</option>");
            if (midiOptions[i] == webmidi.selectedJazzInterface) {
                $appendOption.attr("selected", true);
                anySelected = true;
            }
            allAppendOptions.push($appendOption);
            //console.log(appendOption);
            $newSelect.append($appendOption);
        }
        if (anySelected == false && midiOptions.length > 0) {
            $newSelect.val(midiOptions[0]);
            allAppendOptions[0].attr("selected", true);
            webmidi.selectedJazzInterface = Jazz.MidiInOpen(midiOptions[0], webmidi.jazzMidiInArrived);
            anySelected = true;
        } else {
            noneAppendOption.attr("selected", true);
        }
        if (params.onsuccess !== undefined) {
            params.onsuccess();
        }
        if (anySelected === true && params.oninputsuccess !== undefined) {
            params.oninputsuccess();
        } else if (anySelected === false && params.oninputempty !== undefined) {
            params.oninputempty();
        }
        
    };    
    
	/**
	 * Function to be called if the webmidi-api selection changes. (not jazz)
	 * 
	 */
	webmidi.selectionChanged = function () {
        var selectedInput = webmidi.$select.val();
        if (selectedInput == webmidi.selectedInputPort) {
            return;
        } 
        var storedStateChange = webmidi.access.onstatechange; // port.close() fires onstatechange, so turn off for a moment.
        webmidi.access.onstatechange = function () {}
        if (music21.debug) {
            console.log("current input changed to: " + selectedInput);
        }
        webmidi.selectedInputPort = selectedInput;
            
        webmidi.access.inputs.forEach( function (port) {
            if (port.name == selectedInput) {
                port.onmidimessage = webmidi.midiInArrived;
            } else {
                port.close();
            }
        });	    
        webmidi.access.onstatechange = storedStateChange;
        return false;
	};
	
	/**
	 * Creates a &lt;select&gt; object for selecting among the MIDI choices in Jazz
	 *
	 * The options object has several parameters:
	 * 
	 * {bool} autoupdate -- should this auto update?
	 * {function} onsuccess -- function to call on all successful port queries
	 * {function} oninputsuccess -- function to call if successful and at least one input device is found
	 * {function} oninputempty -- function to call if successful but no input devices are found.
	 * {bool} existingMidiSelect -- is there already a select tag for MIDI?
	 * 
	 * @function music21.webmidi.createSelector
	 * @param {JQueryDOMObject|DOMObject} [$midiSelectDiv=$('body')] - object to append the select to
	 * @param {object} [options] - see above.
	 * @returns {DOMObject|undefined} DOM object containing the select tag, or undefined if Jazz cannot be loaded.
	 */
	webmidi.createSelector = function ($midiSelectDiv, options) {
	    var params = {
	            autoUpdate: true,
	            existingMidiSelect: false
	    };
	    common.merge(params, options);
	    
	    if (typeof($midiSelectDiv) == 'undefined') {
	        $midiSelectDiv = $("body");
        }
	    if ($midiSelectDiv.jquery == undefined) {
	        $midiSelectDiv = $($midiSelectDiv);
	    }
	    var $newSelect;
	    var foundMidiSelects = $midiSelectDiv.find('select#midiInSelect'); 
	    if (foundMidiSelects.length > 0) {
	        $newSelect = foundMidiSelects[0];
	        params.existingMidiSelect = true;
	    } else {
	        $newSelect = $("<select>").attr('id','midiInSelect');	        
	        $midiSelectDiv.append($newSelect);
	    }
        webmidi.$select = $newSelect;
	    
	    if (navigator.requestMIDIAccess === undefined) {
	        webmidi.createJazzSelector($newSelect, params);
	    } else {
	        if (params.existingMidiSelect !== true) {
	            $newSelect.change( webmidi.selectionChanged );          
	        }
	        navigator.requestMIDIAccess().then(function(access) {
	            webmidi.access = access;
	            webmidi.populateSelect();
	            if (params.autoUpdate) {
	                access.onstatechange = webmidi.populateSelect;
	            }
	            webmidi.$select.change();
	            if (params.onsuccess !== undefined) {
	                params.onsuccess();
	            }
	            if (webmidi.selectedInputPort !== "None" && params.oninputsuccess !== undefined) {
	                params.oninputsuccess();
	            } else if (webmidi.selectedInputPort === "None" && params.oninputempty !== undefined) {
	                params.oninputempty();
	            }

	        }, function (e) {
	            $midiSelectDiv.html(e.message);
	        });
	    }
        miditools.clearOldChords(); // starts the chord checking process.
	    return $newSelect;
	};

    webmidi.populateSelect = function() {
        var inputs = webmidi.access.inputs;
        webmidi.$select.empty();
        
        var $noneAppendOption = $("<option value='None'>None selected</option>");
        webmidi.$select.append($noneAppendOption);
        
        var allAppendOptions = [];
        var midiOptions = [];
        var i = 0;
        inputs.forEach( function(port) {
            var $appendOption = $("<option value='" + port.name + "'>" + port.name + "</option>");
            allAppendOptions.push($appendOption);
            midiOptions.push(port.name);
            //console.log(appendOption);
            webmidi.$select.append($appendOption);
            i++;
        });
        if (allAppendOptions.length > 0) {
            webmidi.$select.val(midiOptions[0]);
            allAppendOptions[0].attr("selected", true);
        } else {
            $noneAppendOption.attr("selected", true);
        }
        webmidi.$select.change();
    };
	
	
	
	// end of define
	if (typeof(music21) != "undefined") {
		music21.webmidi = webmidi;
	}		
	return webmidi;
});

/**
 * Example smallest usage of the webmidi toolkit.  see testHTML/midiInRequire.html 
 
<html>
<head>
    <title>MIDI In/Jazz Test for Music21j</title>
    <!-- for MSIE 10 on Windows 8 -->
    <meta http-equiv="X-UA-Compatible" content="requiresActiveX=true"/>
    <script data-main="../src/music21.js" src="../ext/require/require.js"></script>
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />

    <script>
    var s = "";
    function displayStream(me) {
        me.sendToMIDIjs();
        if (me.noteOn) {
            var m21n = me.music21Note();
            if (s.length > 7) {
                s.elements = s.elements.slice(1)
            }
            s.append(m21n);
            var $canvasDiv = $("#canvasDiv");
            $canvasDiv.empty();
            var canv = s.appendNewCanvas($canvasDiv);
        }
    }
    
    require(['music21'], function () { 
        s = new music21.stream.Stream();
        music21.webmidi.createSelector($("#putMidiSelectHere"));
        music21.webmidi.callBacks.general = displayStream;
    });
    
    
    </script>
</head>
<body>
<div>
MIDI Input: <div id="putMidiSelectHere" />
</div>
<div id="canvasDiv">
    <canvas />
</div>
</body>
</html>
**/