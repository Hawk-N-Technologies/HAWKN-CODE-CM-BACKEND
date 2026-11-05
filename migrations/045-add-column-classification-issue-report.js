"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("issue_reports");

    if (table.classification) {
      console.log("classification column already exists");
      return;
    }

    await queryInterface.addColumn("issue_reports", "classification", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "Bug",
    });

    await queryInterface.addConstraint("issue_reports", {
      fields: ["classification"],
      type: "check",
      where: {
        classification: ["Bug", "Issue", "Change Request"],
      },
      name: "chk_issue_reports_classification",
    });

    console.log("classification column added successfully");
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("issue_reports");

    if (!table.classification) {
      console.log("classification column does not exist");
      return;
    }

    await queryInterface.removeConstraint(
      "issue_reports",
      "chk_issue_reports_classification",
    );

    await queryInterface.removeColumn("issue_reports", "classification");
  },
};
