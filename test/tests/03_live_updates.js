var LivePerson = DS.Firebase.LiveModel.extend({
  firstName: DS.attr('string'),
  lastName: DS.attr('string'),
  twitter: DS.attr('string'),
  github: DS.attr('string')
});

LivePerson.toString = function() {
  return "App.LivePerson";
};

module('Live property updates', {
  setup: function() {
    stop();

    fb.remove(function() {
      this.adapter = DS.Firebase.Adapter.create({
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
    this.yehuda = LivePerson.createRecord({
      firstName: "Yehuda",
      lastName: "Katz",
      twitter: "wycats",
    });

    this.store.commit();
  },

  teardown: function() {
    stop();
    this.adapter.fb.child("live_persons").off();
    this.yehuda = null;

    Ember.run.sync();
    Ember.run(function() {
      this.adapter.destroy();
      this.store.destroy();
      start();
    }.bind(this));
  }
});

asyncTest("Properties can be added on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("github"), "wycats", "A property added on Firebase will be added to the model");
    start();
  });

  fb.child("live_persons").child(this.yehuda.get("id")).child("github").set("wycats");
});

asyncTest("Properties can be updated on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), "yehuda_katz", "A property changed on Firebase will be changed on the model");
    start();
  });

  // make sure model has synced back to the server before setting a direct property.
  setTimeout(function() {
    fb.child("live_persons").child(this.yehuda.get("id")).child("twitter").set("yehuda_katz");
  }.bind(this), 250);
});

asyncTest("Properties can be removed on the back-end", function() {
  expect(1);

  this.populate();

  this.yehuda.one("didUpdate", function() {
    equal(this.get("twitter"), null, "A property removed on Firebase will be removed on the model");
    start();
  });

  setTimeout(function() {
    fb.child("live_persons").child(this.yehuda.get("id")).child("twitter").remove();
  }.bind(this), 250);
});


