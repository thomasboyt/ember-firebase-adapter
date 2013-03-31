// deps: global jquery, global DS, global Firebase
//

DS.Firebase = {};

// via @rpflorence's localstorage adapter
// works around lack of root element when passing array
DS.Firebase.Serializer = DS.JSONSerializer.extend({
  extract: function(loader, json, type, record) {
    this._super(loader, this.rootJSON(json, type), type, record);
  },
  
  extractMany: function(loader, json, type, records) {
    this._super(loader, this.rootJSON(json, type, 'pluralize'), type, records);    
  },

  rootJSON: function(json, type, pluralize) {
    var root = this.rootForType(type);
    if (pluralize == 'pluralize') { root = this.pluralize(root); }
    var rootedJSON = {};
    rootedJSON[root] = json;
    return rootedJSON;
  }
});

DS.Firebase.Adapter = DS.Adapter.extend({
  serializer: DS.Firebase.Serializer.create(),

  // todo: make far more granular. possibly per model/controller?
  live: false,

  localLock: false,

  refs: {},

  init: function() {
    if (!this.dbName && !this.url) {
      throw new Error("You must specify a dbName representing the subdomain of your Firebase.");
    }

    if (!this.url) this.url = "https://" + this.dbName + ".firebaseio.com";
    this.refs.root = new Firebase(this.url);
  },


  createRecords: function(store, type, records) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));
    records.forEach(function(record) {
      var data = record.serialize();

      // goofy. causes child_added callback to ignore local additions, 
      // preventing duplicate items
      this.localLock = true;
      if (!this.refs[name]) this.refs[name] = this.refs.root.child(name);
      var ref = this.refs[name].push(data);
      this.localLock = false;
      
      record.set("id", ref.name())
      this.refs[ref.name()] = ref;

    }.bind(this));
    store.didSaveRecords(records);
  },

  updateRecords: function(store, type, records) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));
    records.forEach(function(record) {
      var data = record.serialize();

      var ref = this.refs[name].child(record.get("id"));
      this.localLock = true;
      ref.set(data);
      this.localLock = false;

    }.bind(this));
    store.didSaveRecords(records);
  },

  find: function(store, type, id) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));

    this.refs[id] = this.refs.root.child(name).child(id);
    this.refs[id].once("value", function(snapshot) {
      var data = snapshot.val();
      data.id = id;
      
      this.didFindRecord(store, type, data, id);
    }.bind(this));
  },

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
 
});

DS.Firebase.Model = DS.Model.extend({
  init: function() {
    this._super();

    if (this.get("live") == true) {
      this.on("didLoad", function() {
        this.set("_ref", this.store.adapter.refs[this.get("id")]);

        this.get("_ref").on("child_added", function(prop) {
          if (!this.get(prop.name())) {
            this.set(prop.name(), prop.val());
          }
        }.bind(this));
      });
    }
  }
});

