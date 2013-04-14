var User = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),

  screenNames: DS.hasMany('ScreenName')
});
User.toString = function() {
  return "App.User";
};

var ScreenName = DS.Firebase.LiveModel.extend({
  name: DS.attr('string'),

  user: DS.belongsTo('User')
});
ScreenName.toString = function() {
  return "App.ScreenName";
};
  
module('Embedded relationships', {
  setup: function() {
    stop();

    fb.remove(function() {
      var Adapter = DS.Firebase.Adapter;
      Adapter.map(User, {
        screenNames: {embedded: 'always'}
      });

      this.adapter = Adapter.create({
        dbName: window.DB_NAME
      });

      this.store = DS.Store.create({
        adapter: this.adapter,
        revision: 12
      });

      start();
    }.bind(this));
  },
  populate: function() {
    this.id = fb.child("users").push({
      firstName: "Thomas",
      lastName: "Boyt",
      screenNames: {
        github: {name: "thomasboyt"},
        twitter: {name: "thomasaboyt"},
        website: {name: "http://thomasboyt.com"}
      }
    }).name();
  },
  teardown: function() {
    stop();

    this.adapter.fb.child("users").off();

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Embedded hasMany is loaded when its parent is read", function() {
  expect(2);

  this.populate();

  var user = User.find(this.id);

  user.one("didLoad", function() {
    equal(this._data.hasMany.screenNames.length, 3, "Loading a record loads its embedded relationships");
    equal(this.get("screenNames").findProperty("id", "github").get("name"), "thomasboyt", "Loading a relationship's record loads its key as its ID & loads its properties");
    start();
  });
});

asyncTest("When an embedded model is created, its parent is updated", function() {
  expect(2);

  this.populate();

  var user = User.find(this.id);

  user.one("didLoad", function() {
    var newScreenName = ScreenName.createRecord({
      name: "me@thomasboyt.com",
      id: "email",
      user: user
    });

    user.one("didUpdate", function() {
      fb.child("users").child(this.id).child("screenNames").child("email").on("value", function(snap) {
        equal(snap.val().name, "me@thomasboyt.com", "Creating an embedded model creates a new Firebase resource");
        equal(snap.val().user, this.id, "Creating an embedded model with a belongsTo sets a parent id property");
        start();
      }.bind(this));
    }.bind(this));

    this.store.commit();
  }.bind(this));
});

