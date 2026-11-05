"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("issue_reports");

    // Add classification column if not exists
    if (!table.classification) {
      await queryInterface.addColumn("issue_reports", "classification", {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Bug",
      });
    }

    // Add status column if not exists
    if (!table.status) {
      await queryInterface.addColumn("issue_reports", "status", {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Submitted",
      });
    }

    // Drop existing classification constraint
    try {
      await queryInterface.removeConstraint(
        "issue_reports",
        "chk_issue_reports_classification",
      );
    } catch (error) {
      console.log("Classification constraint does not exist");
    }

    // Recreate classification constraint
    await queryInterface.addConstraint("issue_reports", {
      fields: ["classification"],
      type: "check",
      where: {
        classification: ["Bug", "Issue", "Change Request"],
      },
      name: "chk_issue_reports_classification",
    });

    // Drop existing status constraint
    try {
      await queryInterface.removeConstraint(
        "issue_reports",
        "chk_issue_reports_status",
      );
    } catch (error) {
      console.log("Status constraint does not exist");
    }

    // Recreate status constraint
    await queryInterface.addConstraint("issue_reports", {
      fields: ["status"],
      type: "check",
      where: {
        status: [
          "Submitted",
          "Under Review",
          "Confirmed",
          "Feature Request",
          "Rejected",
          "Solved",
        ],
      },
      name: "chk_issue_reports_status",
    });

    console.log("Classification and status constraints created successfully");
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("issue_reports");

    // Remove classification constraint
    try {
      await queryInterface.removeConstraint(
        "issue_reports",
        "chk_issue_reports_classification",
      );
    } catch (error) {
      console.log("Classification constraint does not exist");
    }

    // Remove status constraint
    try {
      await queryInterface.removeConstraint(
        "issue_reports",
        "chk_issue_reports_status",
      );
    } catch (error) {
      console.log("Status constraint does not exist");
    }

    // Remove columns if they exist
    if (table.classification) {
      await queryInterface.removeColumn("issue_reports", "classification");
    }

    if (table.status) {
      await queryInterface.removeColumn("issue_reports", "status");
    }

    console.log("Classification and status constraints/columns removed");
  },
};
