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

  extractHasMany: function(type, hash, key) {
    var ids = [];
    for (id in hash[key]) ids.push(id);
    return ids;
   //return hash[key];
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
      ref.set(data);

    }.bind(this));
    store.didSaveRecords(records);
  },

  find: function(store, type, id) {
    var name = this.serializer.pluralize(this.serializer.rootForType(type));

    if (!this.refs[name]) this.refs[name] = this.refs.root.child(name)

    console.log(id);
    this.refs[id] = this.refs[name].child(id);
    this.refs[id].once("value", function(snapshot) {
      var data = snapshot.val();
      data.id = id;
      
      this.didFindRecord(store, type, data, id);
    }.bind(this));
  },

  /*findHasMany: function(store, parent, relationship, children) {
    console.log(parent);
    console.log(relationship);
    console.log(children);

    var parentName = this.serializer.pluralize(this.serializer.rootForType(relationship.parentType));
    var name = this.serializer.pluralize(this.serializer.rootForType(relationship.type));

    var children = this.refs[parentName].child(parent.get("id")).child(name);

    children.once("value", function(snapshot) {
      results = [];
      snapshot.forEach(function(child) {
        var data = child.val();
        data.id = child.name();
        results.push(Ember.copy(data));
        this.refs[data.id] = child.ref();
      }.bind(this));

      this.didFindHasMany(store, parent, relationship, children, results);
    }.bind(this));

  },*/

  //didFindHasMany: function(store, parent, relationship, children, results) {
    //var loader = DS.loaderFor(store);
    //var serializer = this.get("serializer");

  //},
 
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

DS.Firebase.LiveModel = DS.Model.extend({
  _ref: undefined,

  init: function() {
    this._super();

    this.on("didLoad", function() {
      this.set("_ref", this.store.adapter.refs[this.get("id")]);

      this.get("_ref").on("child_added", function(prop) {
        if (this._data.attributes.hasOwnProperty(prop.name())) {
          console.log("adding prop " + prop.name()); 
          this.set(prop.name(), prop.val());
        }
      }.bind(this));

      this.get("_ref").on("child_changed", function(prop) {
        if (prop.val() != this.get(prop.name())) {
          console.log("setting");
          this.set(prop.name(), prop.val());
        }
      }.bind(this));
    });
  }
});

