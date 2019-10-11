const express = require("express");
const router = express.Router();
const ensure = require("connect-ensure-login");
const { Projects, ProjectTypes } = require("../../../models/sequelize");
const fs = require("fs");
const Op = require("sequelize").Op;
const { validationResult, checkSchema } = require("express-validator/check");
const { projectSchema } = require("../../constants");

router.post(
  "/",
  ensure.ensureLoggedIn(),
  checkSchema(projectSchema),
  async (req, res) => {
    try {
      if (req.user.role === "ROLE_USER" || req.user.role === "ROLE_BARRED") {
        return;
      }
      let project = await Projects.findOne({
        where: { title: { [Op.eq]: req.body.title } }
      });
      if (project) {
        // can't label something the same as another project
        res
          .status(200)
          .json({ success: false, error: "Project name is already taken" });
      } else {
        // no project
        let errors = validationResult(req).array();
        if (errors.length > 0) {
          throw "400";
        }
        let type = await ProjectTypes.findOne({
          where: { id: { [Op.eq]: req.body.type } }
        });
        if (!type) {
          throw "404";
        }
        let new_project = await Projects.build({
          title: req.body.title,
          description: req.body.description,
          full_description: req.body.full_description,
          allowed: [req.user.id],
          public: req.body.public,
          type: type.id,
          requested: [],
          refused: [],
          owner: req.user.id
        });
        await new_project.save();
        let projects = req.user.owned_projects;
        projects.push(new_project.id);
        await req.user.update({
          owned_projects: projects,
          current_project: new_project.id
        });
        let proj = {
          title: new_project.title,
          description: new_project.description,
          full_description: new_project.full_description,
          allowed: new_project.allowed,
          owner: new_project.owner
        };
        fs.mkdirSync(`../../uploads/${new_project.id}`, { recursive: true });
        res.status(200).json({ success: true, project: proj });
      }
    } catch (err) {
      if (err === "400") {
        let error = validationResult(req).array();
        return res.status(400).json({
          success: false,
          error
        });
      } else if (err === "404") {
        return res
          .status(400)
          .json({ success: false, error: `Incorrect type.` });
      }
      res.status(500).json({ success: false, error: `Server error: ${err}` });
    }
  }
);

module.exports = router;
