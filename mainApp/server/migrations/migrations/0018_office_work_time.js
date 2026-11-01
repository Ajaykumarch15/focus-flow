module.exports = {
  async up({ db }) {
    await db.collection('officeworktimes').createIndex({ userId: 1, date: 1 }, { unique: true });
  },
  async down({ db }) {
    await db.collection('officeworktimes').dropIndex({ userId: 1, date: 1 });
  },
};
