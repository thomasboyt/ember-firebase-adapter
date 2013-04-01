// deps: global jquery, global DS, global Firebase
//

DS.Firebase = {};

DS.Firebase.Serializer = DS.JSONSerializer.extend({
  extract: function(loader, json, type, record) {
    this._super(loader, this.rootJSON(json, type), type, record);
  },
  
  extractMany: function(loader, json, type, records) {
    this._super(loader, this.rootJSON(json, type, 'pluralize'), type, records);    
  },

  extractHasMany: function(type, hash, key) {
    /*var ids = [];
    for (id in hash[key]) ids.push(id);
    return ids;*/

   return hash[key]
  },

  /*materializeHasMany: function(name, record, hash, relationship) {
    console.log(arguments);
  },*/

  rootJSON: function(json, type, pluralize) {
    var root = this.rootForType(type);
    if (pluralize == 'pluralize') { root = this.pluralize(root); }
    var rootedJSON = {};
    rootedJSON[root] = json;
    return rootedJSON;
  },

  addHasMany: function(hash, record, key, relationship) {
    var name = relationship.key;
    var manyArray = record.get(name);
    var ref = record.getRef();

    var serializedHasMany = {};

    manyArray.forEach(function(childRecord) {
      childRecord.getRef(record.get("id"));     // hacky - forces id creation
      serializedHasMany[childRecord.get("id")] = childRecord.serialize();
    });

    hash[key] = serializedHasMany;

  }
});

DS.Firebase.Adapter = DS.Adapter.extend({
  serializer: DS.Firebase.Serializer.create(),

  localLock: false,

  fb: undefined,

  init: function() {
    if (!this.dbName && !this.url) {
      throw new Error("You must specify a dbName representing the subdomain of your Firebase.");
    }

    if (!this.url) this.url = "https://" + this.dbName + ".firebaseio.com";
    this.fb = new Firebase(this.url);
  },

  createRecords: function(store, type, records) {
    records.forEach(function(record) {
      var ref = record.getRef();
      var data = record.serialize();

      // goofy. causes child_added callback to ignore local additions, 
      // preventing duplicate items
      this.localLock = true;
      var newRef = ref.set(data);
      this.localLock = false;
      
      //record.set("id", newRef.name())
    }.bind(this));
    store.didSaveRecords(records);
  },

  updateRecords: function(store, type, records) {
    records.forEach(function(record) {
      console.log(record);
      var ref = record.getRef();
      var data = record.serialize();
      console.log(data);

      console.log(ref.toString());
      ref.set(data);
    }.bind(this));
    store.didSaveRecords(records);
  },

  find: function(store, type, id) {
    var ref = this._getRefForType(type).child(id);
    ref.once("value", function(snapshot) {
      var data = snapshot.val();
      data.id = id;
      
      this.didFindRecord(store, type, data, id);
    }.bind(this));
  },

  /*findMany: function(store, type, ids, parent) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));

    // todo: handle if parent has parent, etc.
    var ref;
    if (parent) {
      var parentName = this.serializer.pluralize(this.serializer.rootForType(parent.constructor));

      ref = parent.getRef().child(name);
    }
    else {
      ref = fb.child(name);
    }

    for (var i = 0; i<ids.length; i++) {
      var id = ids[i];
      var childRef = ref.child(id);

      var results = [];

      childRef.once("value", function(snapshot) {
        var data = snapshot.val();
        data.id = snapshot.name();

        if (parent) {
          // add id of parent
          var key = this.serializer.rootForType(parent.constructor);
          data[key] = parent.get("id");
        }
        
        results.push(data);

        if (results.length == ids.length) {
          this.didFindMany(store, type, results);
        }
        
      }.bind(this));
    }
  },*/

  /*findHasMany: function(store, parent, relation, children) {
    // there is no "findHasMany" needed - just load the children
    for (key in children) {
      var id = key;
      var ids = Object.keys(children);
      var data = children[key];
      data.person = parent.get("id");
    };
    console.log("doing findmany");
    this.didFindMany(store, relation.type, data);
  },*/

  findAll: function(store, type) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));
    
    this.refs[name] = this.refs.root.child(name);
    this.refs[name].once("value", function(snapshot) {
      var results = [];
      snapshot.forEach(function(child) {
        var data = child.val();
        data.id = child.name();
        results.push(Ember.copy(data));

        this.refs[data.id] = child.ref();
      }.bind(this));
      
      this.didFindAll(store, type, results);

      this.refs[name].on("child_added", function(child) {
        if (!this.localLock) {
          var id = child.name()
          var data = child.val()
          data.id = id;
          this.refs[id] = child.ref();
          this.didFindMany(store, type, [data]);
        }
      }.bind(this));

    }.bind(this));
  },

  _getRefForType: function(type, record) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));

    // TODO: Belongs to
    return this.fb.child(name);
  }

});

DS.Firebase.LiveModel = DS.Model.extend({
  getRef: function(collection) {
    var adapter = this.store.adapter;
    var serializer = adapter.serializer;

    var name = serializer.pluralize(serializer.rootForType(this.constructor));

    var parentRef;

    // find belongsTo assocations
    var key;
    Ember.get(this.constructor, 'relationshipsByName')
      .forEach(function(rkey, relation) {
        if (relation.kind == "belongsTo" && relation.parentType == this.constructor)
          key = rkey;
      }.bind(this));

    //console.log(key);
    //console.log(this.constructor);
    //console.log("---");
    if (key) {
      console.log(key);
      console.log(this.get(key));
      parentRef = this.get(key).getRef();
    }
    else {
      parentRef = adapter.fb;
    }

    if (!this.get("id")) {
      var newRef = parentRef.child(name).push();
      this.set("id", newRef.name());
      return newRef;
    }
    else
      return parentRef.child(name).child(this.get("id"));
  },

  init: function() {
    this._super();

    this.on("didLoad", function() {
      var ref = this.getRef();

      ref.on("child_added", function(prop) {
        if (this._data.attributes.hasOwnProperty(prop.name()) && !(this.get(prop.name()))) {
          console.log("adding prop " + prop.name()); 
          this.set(prop.name(), prop.val());
        }
      }.bind(this));

      ref.on("child_changed", function(prop) {
        if (prop.val() != this.get(prop.name())) {
          console.log("setting");
          this.set(prop.name(), prop.val());
        }
      }.bind(this));
    }.bind(this));
  },

  /*materializeHasMany: function(name, ids) {
    this._super();
  }*/
});

