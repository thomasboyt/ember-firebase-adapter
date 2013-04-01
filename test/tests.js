QUnit.config.autostart = false;
QUnit.config.reorder = false;

var fb = new Firebase("https://" + window.DB_NAME + ".firebaseio.com")

var store, adapter, Person, Project, yehudaId

var yehudaFixture = {
  firstName: "Yehuda",
  lastName: "Katz",
  twitter: "wycats",
  github: null,
}

module('DS.Firebase.Adapter', {
  setup: function() {
    // reset firebase
    fb.remove();

    // People fixture tests lists
    var persons = fb.child("persons");
    var yehuda = persons.push(yehudaFixture);
    yehuda.child("projects").push({name: "Rack::Offline"});
    yehuda.child("projects").push({name: "emberjs"});
    
    yehudaId = yehuda.name();

    var tom = persons.push({
      firstName: "Tom",
      lastName: "Dale",
      twitter: "tomdale",
    });

    Person = DS.Firebase.LiveModel.extend({
      firstName: DS.attr('string'),
      lastName: DS.attr('string'),
      twitter: DS.attr('string'),
      github: DS.attr('string'),

      projects: DS.hasMany('Project')
    });
    Person.toString = function() {
      return "App.Person";
    };

    Project = DS.Firebase.LiveModel.extend({
      name: DS.attr('string'),
      belongsTo: Person
    });

    Project.toString = function() {
      return "App.Project";
    };

    adapter = DS.Firebase.Adapter.create({
      dbName: window.DB_NAME
    });
    store = DS.Store.create({
      adapter: adapter,
      revision: 12
    });
  },
  teardown: function() {
    adapter.destroy();
    store.destroy();
  }
});

test("find", function() {
  stop();
  var person = Person.find(yehudaId);
  person.on("didLoad", function() {
    deepEqual(person._data.attributes, yehudaFixture, "Record retrieved with find() has attributes equal to the stored record");
    Ember.run.later(function() {
      console.log(person.get("projects"));
    }, 400);
    start();
  });
});

test("live", function() {
  stop();
  var person = Person.find(yehudaId);
  
  person.on("didLoad", function() {

    var ref = fb.child("persons").child(yehudaId).child("github");
    ref.set("wycats");

    // todo: there has to be some event to listen to instead of this
    // (this isn't too bad though - not listening for some ajax event; the
    // setter should be near-instant)
    Ember.run.later(function() {
      equal(person.get("github"), "wycats", "Model added github property when it was added on fb reference.");
      start();
    }, 200);
  });
});

test("createRecord", function() {
  stop();
  var person = Person.createRecord({
    firstName: "Romy",
    lastName: "Hong",
    twitter: "RomyOnRuby"
  });

  person.on("didCreate", function() {
    ok(person.get("id"), "Person model has an id after being saved.");
    start();
  });

  store.commit();

});

test("updateRecord", function() {
  stop();

  var person = Person.find(yehudaId);
  
  person.on("didLoad", function() {
    person.set("twitter", "yehuda_katz");
    person.set("github", "wycats");

    person.on("didUpdate", function() {
      var ref = fb.child("persons").child(person.get("id")).child("twitter");
      ref.on("value", function(snapshot) {
        equal(snapshot.val(), "yehuda_katz", "Changes were synced back to firebase record");
        start();
      });
    });

    store.commit();
  });
});

QUnit.start();
