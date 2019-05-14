/*
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Component, EventEmitter, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MatSelect} from '@angular/material/select';
import {OAuthService} from 'angular-oauth2-oidc';
import * as _ from 'lodash';
import {defer, EMPTY, Observable, of, Subject, Subscription} from 'rxjs';
import {catchError, filter, takeUntil} from 'rxjs/operators';

import {BigQueryService} from '../big-query.service';
import {LogService} from '../log.service';
import {BqProject, BqProjectListResponse} from '../rest_interfaces';

/** UI for 'download from GCP'. */
@Component({
  selector: 'app-projects',
  templateUrl: './projects.component.html',
  styleUrls: ['./projects.component.css']
})
export class ProjectsComponent implements OnInit, OnDestroy {
  allProjects: BqProject[];  // All the projects that are available.
  projects: BqProject[];  // The list of projects matching the current filter.
  projectFilter = '';
  selectedProject: BqProject;
  isLoading: boolean;
  private readonly destroy = new Subject<void>();
  @ViewChild('projectSelect') projectSelect;

  // Emitted events.
  @Output() getJobs = new EventEmitter<BqProject>();

  constructor(
      private http: HttpClient, private oauthService: OAuthService,
      private bqService: BigQueryService, private logSvc: LogService) {}

  async ngOnInit() {
    this.projectSelect.selectionChange.subscribe(event => {
      // Store the last selected project in the local storage.
      localStorage.setItem('lastProjectId', event.value.id);
    });

    // Fetch the projects list from session storage
    const p = sessionStorage.getItem('projects');
    if (p) {
      this.allProjects = JSON.parse(p);
      this.doneLoadingProjects();
    } else {
      this.allProjects = [];
      this.projects = [];
      // this.getProjects(); // disabled until we find a way to do this after
      // the user is logged in
    }
  }

  ngOnDestroy() {
    this.destroy.next();
  }

  async getProjects() {
    this.isLoading = true;
    this.projects = [];
    this.allProjects = [];
    this.bqService.getProjects()
        .pipe(takeUntil(this.destroy))
        .subscribe(
            project => {
              this.allProjects.push(project);
            },
            err => {
              this.logSvc.error(`getProjects failed: ${err}`);
              this.isLoading = false;
            },
            () => {
              this.doneLoadingProjects();
            });
  }

  private async doneLoadingProjects() {
    this.allProjects = _.sortBy(this.allProjects, ['id']);

    // Select the previously selected project.
    if (localStorage.getItem('lastProjectId')) {
      const project = _.find(
          this.allProjects, p => p.id == localStorage.getItem('lastProjectId'));
      if (project) {
        this.selectedProject = project;
      }
    }

    // Select the first project if one isn't selected.
    if (!this.selectedProject && this.allProjects.length) {
      this.selectedProject = this.allProjects[0];
      localStorage.setItem('lastProjectId', this.selectedProject.id);
    }

    // Save the projects list for later.
    sessionStorage.setItem('projects', JSON.stringify(this.allProjects));

    // Run the filter to update the displayed list of projects.
    await this.updateFilter();

    this.isLoading = false;
  }

  async updateFilter() {
    if (this.projectFilter) {
      this.projects = this.allProjects.filter(
          p => p.id.lastIndexOf(this.projectFilter) >= 0);
    } else {
      this.projects = this.allProjects;
    }
  }

  listJobs(): void {
    if (this.selectedProject) {
      this.getJobs.emit(this.selectedProject);
    }
  }
}
