export var Model = DS.Model.extend({
  getRef: function(collection) {
    var adapter = this.store.adapter;
    var serializer = adapter.serializer;

    var name = serializer.pluralize(serializer.rootForType(this.constructor));

    // find belongsTo assocations
    var key;
    Ember.get(this.constructor, 'relationshipsByName')
      .forEach(function(rkey, relation) {
        if (relation.kind == "belongsTo" && relation.parentType == this.constructor) {
          if (serializer.embeddedType(relation.type, name))
            key = rkey;
        }
      }.bind(this));

    var parentRef;
    if (key) {
      if (this.get(key)) {
        parentRef = this.get(key).getRef();
      }
      else {
        // *probably* means will be deleted
        // watch out for anything bad that could trigger this.
        return this.get("_ref");
      }
    }
    else {
      parentRef = adapter.fb;
    }

    var ref;
    if (!this.get("id")) {
      ref = parentRef.child(name).push(); // generates new id 
      this.set("id", ref.name());
    }
    else {
      ref = parentRef.child(name).child(this.get("id"));
    }

    this.set("_ref", ref);
    return ref;
  }
});

export var LiveModel = Model.extend({
  init: function() {
    this._super();

    // a model will fire one of these two events when created
    this.on("didLoad", this._initLiveBindings.bind(this));
    this.on("didCreate", this._initLiveBindings.bind(this));
  },

  _initLiveBindings: function() {
    if (!this.get("_liveBindingsWereEnabled")) {    // sanity check
      this.set("_liveBindingsWereEnabled", true);
      var ref = this.getRef();

      // get all possible attributes that aren't relationships for check
      var attrs = Ember.get(this.constructor, "attributes");

      ref.on("child_added", function(prop) {
        if (attrs.get(prop.name()) && (this.get(prop.name()) === undefined)) {
          this.store.didUpdateAttribute(this, prop.name(), prop.val());
          this.trigger("didUpdate");
        }
      }.bind(this));
      ref.on("child_changed", function(prop) {
        if (attrs.get(prop.name()) && prop.val() !== this.get(prop.name())) {
          this.store.didUpdateAttribute(this, prop.name(), prop.val());
          this.trigger("didUpdate");
        }
      }.bind(this));
      ref.on("child_removed", function(prop) {
        // hacky: child_removed doesn't seem to be properly removed when .off() is
        // used on the reference, which can make bad things happen if the resource
        // is removed and the model no longer exists!
        if (!this.bindingsDisabled) {
          if (attrs.get(prop.name()) && (this.get(prop.name()) !== undefined || this.get(prop.name() !== null))) {
            this.store.didUpdateAttribute(this, prop.name(), null);
            this.trigger("didUpdate");
          }
        }
      }.bind(this));

      this.store.adapter._listenRefs.push(ref);

      this.get("constructor.relationshipsByName").forEach(function(name, relationship) {
        if (relationship.kind == "hasMany" && relationship.options.live === true) {
          console.log("adding live relation for " + relationship.key);
          var embedded = this.store.adapter.serializer.mappingOption(this.constructor, relationship.key, "embedded");

          // embedded relationship
          if (embedded == "always") {
            ref.child(relationship.key).on("child_added", function(snapshot) {
              var id = snapshot.name();

              // todo: likely very inefficient. may be a better way to get
              // list of ids - see how it's done when loading records
              var ids = this.get(relationship.key).map(function(item) {return item.get("id")});
              if (ids.contains(id)) { return; }

              var data = snapshot.val();
              var id = snapshot.name();
              data.id = id
              
              // find belongsTo key that matches the relationship
              var match;
              Ember.get(relationship.type, "relationshipsByName").forEach(function(name, relation) {
                if (relation.kind == "belongsTo" && relation.type == relationship.parentType)
                  match = name;
              });

              if(match) data[match] = this;

              // TODO: this kind of sucks. it's a workaround for didFindRecord
              // not playing nice with associations, for whatever reason.
              var rec = relationship.type.createRecord(data);

              // keeps the record from being attempted to be saved back to
              // the server
              rec.get('stateManager').send('willCommit');
              rec.get('stateManager').send('didCommit');

              rec._initLiveBindings();
            }.bind(this));

            ref.child(relationship.key).on("child_removed", function(snapshot) {
              var id = snapshot.name();

              var rec = this.get(relationship.key).find(function(item) {return item.get("id") == id});
              
              if (!rec) return;
              
              rec.deleteRecord();

              // fake sync
              rec.get('stateManager').send('willCommit');
              rec.get('stateManager').send('didCommit');
            }.bind(this));
          }

          else {
            ref.child(relationship.key).on("child_added", function(snapshot) {
              var id = snapshot.name();

              var ids = this._data.hasMany[relationship.key];
              var state = this.get("stateManager.currentState.name");

              // below: the magic of ember data
              if (state === "inFlight") {return;}   // if inFlight, id will not be pushed to hasMany yet.
              if (ids === undefined)     {return;}   // this one is pretty baffling.
              if (ids.contains(id))     {return;}   // this one is obvious, and in a perfect world would be the only one needed.

              var mdl = relationship.type.find(id);
              
              this.get(relationship.key).pushObject(mdl);
            }.bind(this));

            ref.child(relationship.key).on("child_removed", function(snapshot) {
              var id = snapshot.name();

              var rec = this.get(relationship.key).find(function(item) {return item.get("id") == id;});
              if (!rec) return;

              rec.deleteRecord();
              rec.get('stateManager').send('willCommit');
              rec.get('stateManager').send('didCommit');
            }.bind(this));
          }
        }
      }.bind(this))
    }
  },

  deleteRecord: function() {
    this.disableBindings();
    this._super();
  },
});
