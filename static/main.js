var app = app || {}; // The Application

/**
 *   main.js
 *
 *   This file is currently a kitchen sink of components.
 *   Once the layout of the page stabilizes (all controls are present
 *   and dynamic creation of templates for individual graph simulations is implemented),
 *   this will be cleaned and refactored.
 *
 *   Currently this file contains
 *   app.GraphControlsView: view to control graph parameters.
 *     currently contains just the spinner to adjust vertex #
 *   app.AnimationControlView: animation control for individual graphs
 *   app.MasterControlsView: master animation control
 *   app.AlgoView: render an algorithm simulation panel
 *   app.ModalView: modal for tne editor
 *   app.AlgoModel: model driving the editor
 *   app.MainView
 */

app.GraphControlsView = Backbone.View.extend({

	el: "#spinner-form-group",

	template: '\
	    <label>Number of vertices:</label>\
    <div class="input-group spinner">\
    <input type="text" class="form-control" value="6">\
      <div class="input-group-btn-vertical">\
        <button class="btn btn-default"><i class="fa fa-caret-up"></i></button>\
        <button class="btn btn-default"><i class="fa fa-caret-down"></i></button>\
      </div>\
    </div>\
	',

	// template: 'Number of vertices: <input type="text" id="spinner" value="6" style="width: 80px;" />',
	_bindSpinnerArrows: function() {
		var $spinner = this.$(".spinner input");
		// need to return false from handlers, otherwise bootstrap
		// will try to submit the form and reload the page
		$(".spinner .btn:first-of-type").on("click", function() {
			if (this._getVal() < this.max) {
				$spinner.val(this._getVal() + 1);
				this.model.set("V", this._getVal());
			}
			return false;
		}.bind(this));
		$(".spinner .btn:last-of-type").on("click", function() {
			if (this._getVal() > this.min) {
				$spinner.val(this._getVal() - 1);
				this.model.set("V", this._getVal());
			}
			return false;
		}.bind(this));
	},

	_initSpinner: function() {
		this._bindSpinnerArrows();
		var that = this;
		$("input").change(function() {
			if ($(this).val().match(/^\d+$/)) {
				var v = that._getVal();
				if (v >= that.min && v <= that.max) {
					that.model.set("V", v);
					return;
				}
			}
			that.$spinner.val(that.model.get("V"));
		});
	},

	_getVal: function() {
		return parseInt(this.$spinner.val(), 10);
	},

	initialize: function(options) {
		options = options || {};
		this.animationModels = options.animationModels;
		this.min = 2;
		this.max = options.max || 100;
		this.defaultV = 4;
		Backbone.View.prototype.initialize.apply(this, arguments);
		if (!this.model.has("V")) {
			this.model.set("V", this.defaultV);
		}
		var playingStateHandler = function(model, val, options) {
			if (model.get("status") === "playing") {
				$("input, .spinner .btn:first-of-type, .spinner .btn:last-of-type")
					.prop("disabled", true);
			} else {
				$("input, .spinner .btn:first-of-type, .spinner .btn:last-of-type")
					.prop("disabled", false);
			}
		}.bind(this);

		this.listenTo(this.animationModels, "change", playingStateHandler);
	},

	render: function() {
		this.$el.html(this.template);
		this.$spinner = this.$(".spinner input");
		this._initSpinner();
		this.$spinner.val(this.model.get("V"));
		return this;
	}
});

app.AnimationControlView = Backbone.View.extend({

	template: '<a id="play" class="btn btn-default"><span class="fa fa-play"></span> <span class="mylabel">Run</span></a><a id="step-back" class="btn btn-default"><span class="fa fa-step-backward"></span></a><a id="step-fwd" class="btn btn-default"><span class="fa fa-step-forward"></span></a>',

	initialize: function(options) {
		this.options = options || {};
		this.model.set("status", "new");
		this.model.on('change:status', this.render, this);
		Backbone.View.prototype.initialize.apply(this, arguments);
	},

	_selectivelyDisplayControls: function() {
		if (this.options.showOnly) {
			this.$(".btn").css("display", "none");
			_.each(this.options.showOnly, function(id) {
				this.$("#" + id).css("display", "");
			}.bind(this));
		}
	},

	render: function(){
		this.$el.html(this.template);
		this._selectivelyDisplayControls();
		this.$("span.fa").removeClass("fa-play fa-pause");
		this.$("#play span.fa").addClass('fa-' + (this.isPlaying() ? 'pause' : 'play'));
		this.$("span.mylabel").text(this.isPlaying() ? " Pause" : " Run");
	},

	events: {
		'click a#play': function() {
			this.model.set("status", this.isPlaying() ? "paused" : "playing");
		},
		'click a#step-fwd': function() {
			this.model.set("req_steps", 1);
		},
		'click a#step-back': function() {
			this.model.set("req_steps", -1);
		}
	},
	isPlaying: function(){
		return this.model.get('status') === 'playing';
	}
});

app.AlgoView = Backbone.View.extend({

	initialize: function(options) {
		options = options || {};
		var algo = options.algorithm;
		var AlgoView;
		var viewMap = {"dijkstra": app.DijkstraView,
					   "bellman-ford": app.BellmanFordView,
					   "toposort": app.TopoSortSsspView};
		if (!_.has(viewMap, algo)) {
			// throw new Error("Invalid algorithm name");
			AlgoView = app.AnimatedSimulationBase;
		} else {
			AlgoView = viewMap[algo];
		}
		options.title = options.title || "";
		this.$(".algo-container").attr('data-content', options.title);
		var that = this;
		this.listenTo(this.model, "code:saved", function(model, value, options) {
			var cp = this.model.get("code_ptr");
			console.log("Loading algorithm from editor buffer " + cp);
			var code = this.model.get(cp);
			if (code) {
				eval(code);
				console.log("Re-rendering the view");
				this.graphView.render();
			}
		}.bind(this));

		var modalModel = new Backbone.Model({ title: 'Example Modal', body: 'Hello World' });
		var hiddenCallback = function() {
			console.log("in hidden callback");
				// var gv = that.graphView;
				// gv.recordAnimatedAlgorithm(gv.model.graph, gv.source, gv.target);

		};
		var _listenTo = this.listenTo;
		this.$(".algo-container .edit-link a").click(function() {
			console.log("Edit clicked");
			var view = new app.ModalView2({model: this.model});
			var modal = new Backbone.BootstrapModal({
					content: view,
					title: "Edit this algorithm!",
					animate: false
			});
			_listenTo(modal, "hidden", hiddenCallback);

			modal.open();
			modal.$el.addClass("modal-wide");
		}.bind(this));

		this.animationControlsModel = options.animationControlsModel;
		this.masterAnimationControlsModel = options.masterAnimationControlsModel;
		this.graphModel = options.graphModel || new app.GraphModel({V: 6});
		this.playButton = new app.AnimationControlView({model: this.animationControlsModel});
		this.graphView  = new AlgoView({model: this.graphModel,
										animationModel: this.animationControlsModel});
	},

	render: function() {
		console.log("Rendering algo view");
		this.$(".animation-controls-container").append(this.playButton.$el);
		this.playButton.render();
		this.$(".graph-container").append(this.graphView.$el);
		this.graphView.render();
		return this;
	}
});

// editor view goes here; this is buggy and horrible and very much a work in progress
app.ModalView2 = Backbone.View.extend({

    template: '<div id="edit-controls" style="display: none;"> \
			<ul class="nav nav-tabs" id="editor-tabs"> \
			<li id="default_code"><a href="#" data-toggle="tab">Default</a></li> \
			<li id="edited_code"><a href="#" data-toggle="tab"><button class="close close-tab" type="button" >×</button>Edited</a></li> \
			</ul></div> \
			<div id="edit-area"></div>',

	initialize: function() {
		function saveCallback() {
			if (!this.cm.isClean()) {
				this.model.set("edited_code", this.cm.getValue());
				this.model.set("code_ptr", "edited_code");
				this.model.trigger("code:saved");
				console.log("setting edited value in the model");
			}
		}
		this.on("shown", function(modal) {
			console.log("in shown callback");
			var height = $(window).height() - 200;
			modal.$el.find(".modal-body").css("max-height", height);
		});
		this.on("ok", saveCallback);
	},

    render: function() {
        this.$el.html(this.template);
		var $editControls = this.$("#edit-controls");
		if (!this.model.get("user_defined") && this.model.get("edited_code").match(/\w/)) {
			$editControls.css("display", "");
		} else { // make sure code pointer is set appropriately, even though tabs are hidden
			this.model.set("code_ptr", this.model.get("user_defined") ? "edited_code" : "default_code");
		}
		var cp = this.model.get("code_ptr");
		this.$("li").removeClass("active");
		this.$("li#" + this.model.get("code_ptr")).addClass("active");
		this.$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
			// TODO: FIXME: save code in tmp variable on tab switch
			// so that switching tabs doesn't blow away code
			console.log(e.target); // activated tab
			cp = this.$(e.target).parent().attr("id");
			// TODO: FIXME: rather than setting the code pointer here, save the
			// code pointer state to a variable and commit on save
			// (otherwise the code pointer is set incorrectly on cancel)
			this.model.set("code_ptr", cp);
			this.cm.setOption("readOnly", (cp === "default_code"));
			this.cm.setValue(this.model.get(cp));
			setTimeout(function() { this.cm.refresh(); }.bind(this), 0);

			console.log(e.relatedTarget); // previous tab
		}.bind(this));
		var that = this;
		this.$(".close-tab").click(function () {
			//there are multiple elements which have .close-tab icon so close the tab whose close icon is clicked
			var tabContentId = that.$(this).parent().attr("href");
			var $li = that.$(this).parent().parent();
			var cp = $li.attr("id");
			$li.remove();
			that.model.set(cp, "");
			console.log("Deleting buffer " + cp);
			that.$('#editor-tabs a:last').tab('show'); // Select first tab
			// that.$(tabContentId).remove(); //remove respective tab content

		});
		var cm = this.cm = CodeMirror(this.el, {
			lineNumbers: true,
			theme: "base16-light",
			mode:  "javascript"
		});
		cm.setValue(this.model.get(cp));
		cm.markClean();
		setTimeout(function() {
			cm.refresh();
		}, 0);
        return this;
    }
});

// TODO: decide whether we are sticking with what's now in ModalView2 for the editor
// modal, if so, get rid of this temp code
app.ModalView = Backbone.View.extend({

	events: {
        'click .close': 'close'
    },

    initialize: function() {
        this.template = _.template($('#modal-template').html());
    },

    render: function() {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },

    show: function() {
        $(document.body).append(this.render().el);
    },

    close: function() {
        this.remove();
    }

});

app.MasterControlsView = Backbone.View.extend({

	initialize: function(options) {
		this.animationModels = options.animationModels;
		this.masterAnimationControlsModel = options.masterAnimationControlsModel;
		this.graphControls = new app.GraphControlsView({
			el: "#spinner-form-group",
			model: options.masterGraphModel,
			animationModels: options.animationModels
		});
		this.masterAnimationControls = new app.AnimationControlView({
			el: "#play-controls-form-group",
			model: options.masterAnimationControlsModel,
			showOnly: ["play"]
		});
		this.listenTo(this.animationModels, "change:status", this.stateHandler);
		this.listenTo(this.masterAnimationControlsModel, "change:status", this.masterStateHandler);
	},

	allStopped: function() {
			return this.animationModels.every(function(m) {
				return m.get("status") !== "playing";
			});
	},

	allFinished: function() {
			return this.animationModels.every(function(m) {
				return m.get("status") === "finished";
			});
	},

	masterStateHandler: function(model, val, options) {
		var masterStatus = this.masterAnimationControlsModel.get("status");
		if (masterStatus === "paused" && this.allStopped()) {
			// console.log("Change trigger: master state is changed to paused but everything is stopped; ignoring");
		} else if (masterStatus === "playing" && this.allFinished()) {
			this.animationModels.each(function(model) {
				model.set("status", masterStatus);
			});
		} else {
			this.animationModels.each(function(model) {
				var status = model.get("status");
				if (status !== "finished") {
					// console.log("Setting status of model " + model.cid + " from " + status + " to " + masterStatus);
					model.set("status", masterStatus);
				}
			});
		}
	},

	stateHandler: function(model, val, options) {
		// console.log("Handling state change of model " + model.cid + " from " + model.previous("status") + " to " + model.get("status"));
		if (model.get("status") !== "playing") {
			if (this.allStopped()) {
				console.log("Setting master status to paused");
				this.masterAnimationControls.model.set("status", "paused");
			}
		}
	},

	render: function() {
		this.graphControls.render();
		this.masterAnimationControls.render();
		return this;
	}
});

function hereDoc(f) {
  return f.toString().
      replace(/^[^\/]+\/\*!?/, '').
      replace(/\*\/[^\/]+$/, '');
}

app.AlgoModel = Backbone.Model.extend({

	initialize: function(attributes, options) {
		options = options || {};
		this.animationControlsModel = options.animationControlsModel;
		this.graphModel = options.graphModel;
		if (!_.has(attributes, "algo_id")) {
			throw new Error("Attributes of algo model must include 'algo_id'");
		}
		// TODO: remove this temporary hack
		if (this.get("algo_id") === "user-defined") {
			this.set("user_defined", true);
		}
		if (!this.get("user_defined")) {
			this.loadDefaultCode(); // callbacks?
		}
	},

	loadDefaultCode: function() {
		var dfd = $.Deferred();
		if (!this.get("algo_id")) {
			throw new Error("Algo model does not have a valid ID");
		}
		var path = "/e/" + this.get("algo_id");
		if (this.get("user_defined")) {
			dfd.reject(); // fail when try to get default code
		} else {
			$.get(path).done(function(data) {
				this.set("default_code", data, {silent: true});
				dfd.resolve();
			}.bind(this)).fail(function() { dfd.reject(); });
		}
		return dfd;
	},

	events: {
		"change:algo_id": function() {
			if (this.get("user_defined")) {
				this.set("code_ptr", "edited_code");
			} else {
				this.loadDefaultCode().done(function() {
					this.set("code_ptr", "default_code");
				}.bind(this)).fail(function() {
					this.set("code_ptr", "edited_code");
				}.bind(this));
			}
		}.bind(this)
	},

	defaults: {
		"algo_id": "",
		"title": "untitled",
		"user_defined": false,
		"default_code": "",
		// TODO: make the default edited_code text less kludgy
		"edited_code": "this.graphView.recordAnimatedAlgorithm = function(graph) {\
\
}",
		// This is a "hereDoc" hack to parse a multi-line string from a comment into a variable
		// http://stackoverflow.com/questions/805107/creating-multiline-strings-in-javascript
		// TODO: remove this after debugging, it's here for debugging purposes only
		"edited_code_": hereDoc(function() {/*!
    console.log("IN DYNAMICALLY LOADED CODE");
    this.testing = "HELLO";
 	this.graphView.recordAnimatedAlgorithm = function(graph) {
		var source = this.getSource();
		var target = this.getTarget();
 		this.initializeDistances(graph, source.id);
		target = graph.nodes[3];
 		this.addNodeClass(source.id, "source");
 		this.addNodeClass(target.id, "target");

 		var edgeTo = {};
 		var curDist = graph.nodes[target.id].dist;
 		var annotations = [this.makeStepAnnotation(null, {text: ""}), this.makeShortestPathAnnotation(curDist)];
 		this.initializeAnnotations(annotations);
 		var pq = makeIndexedPQ();
 		var node = graph.nodes[source.id];
 		node.pqHandle = pq.push(node, node.dist);
 		while (!pq.isEmpty()) {
			console.log("ALGO STEP");
 			var curNode = pq.deleteMin();
 			curNode.pqHandle = null;
 			for (var i = 0; i < curNode.adj.length; i++) {
 				var edge = curNode.adj[i];
 				var newDist = edge.target.dist;
 				annotations = [];
 				annotations.push(this.makeStepAnnotation(edge));
 				if (this.isTense(edge)) {
 					newDist = this.relax(edge);
 					edgeTo[edge.target.id] = edge;
 					if (edge.target.pqHandle) {
 						pq.changeKey(edge.target.pqHandle, newDist);
 					} else {
 						edge.target.pqHandle = pq.push(edge.target, newDist);
 					}
 					if (edge.target.id === target.id) {
 						curDist = newDist;
 					}
 				}
 				annotations.push(this.makeShortestPathAnnotation(curDist));
 				graph.links[edge.id].addStatus("visiting");
 				var curPath = this.constructPath(edge.target, edgeTo);
 				_(curPath).each(function(link) {
 					graph.links[link.id].addStatus("active");
 				});
 				this.recordStep(graph, annotations);
 			}
 		}
		console.log("DONE RECORDING");
 	}
												 */}),
		"code_ptr": "default_code"
	}
});

app.MainView = Backbone.View.extend({

	el: "#app-container",

	initialize: function() {
		var algos = ["dijkstra", "bellman-ford", "toposort", "user-defined"];
		// var algos = ["dijkstra", "bellman-ford"];
		var titles = {
			"dijkstra": "Dijkstra's algorithm",
			"bellman-ford": "Bellman-Ford (double for-loop)",
			"toposort": "Relaxing edges in topological order",
			"user-defined": "user-defined"
		};
		this.algoViews = [];
		var graphModels = new Backbone.Collection();
		var animationModels = new Backbone.Collection();
		var graphMasterModel = new app.GraphModel({V: 6});
		var masterAnimationControlsModel = new Backbone.Model({status: "paused"});
		this.masterControlsView = new app.MasterControlsView({
			masterGraphModel: graphMasterModel,
			masterAnimationControlsModel: masterAnimationControlsModel,
			animationModels: animationModels
		});
		_(algos).each(function(x) {
			var animationControlsModel = new Backbone.Model({status: "paused", req_steps: 0});
			var graphModel = new app.GraphModel({V: 6, masterModel: graphMasterModel});
			var algoModel = new app.AlgoModel({algo_id: x, title: titles[x]}, {
				// put child models here?
			});
			var view = new app.AlgoView({
				el: this.$("#" + x + "-container"), algorithm: x,
				model: algoModel,
				animationControlsModel: animationControlsModel,
				masterAnimationControlsModel: masterAnimationControlsModel,
				graphModel: graphModel,
				title: titles[x]
			});
			this.algoViews.push(view);
			graphModels.add(graphModel);
			animationModels.add(animationControlsModel);
		}.bind(this));
	},

	render: function() {
		this.masterControlsView.render();
		_(this.algoViews).each(function(x) {
			x.render();
		});
		return this;
	}
});


$(document).ready(function () {
	var main = new app.MainView();
	main.render();
});
