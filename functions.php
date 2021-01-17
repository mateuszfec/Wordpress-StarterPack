<?php
/**
 * Custom Wordpress functions - for project-full-name
 *
 * Authors: project-author-name (project-author-email)
 * Copyright project-full-name © All Rights Reserved
 */
// --------------------------------------------------- GLOBALS ---------------------------------------------------------
const DASHBOARD_LOGO_URL = '';
const DASHBOARD_LOGO_LABEL = 'project-author-name';
const DASHBOARD_LOGO_ANCHOR = 'project-author-url';

// ------------------------------------------- ASSETS > header + footer ------------------------------------------------
// Site elements loaded with header
function load_assets_in_header() {
    if(!is_admin()) {
        wp_enqueue_style('sample-css', get_template_directory_uri() . '/assets/css/sample.css');
        // wp_enqueue_style('project-short-name-css', get_template_directory_uri() . '/assets/css/project.css');
    }
}
add_action('init', 'load_assets_in_header', 1);

// Site elements loaded with footer
function load_assets_in_footer() {
    if(!is_admin()) {
        // Libraries
        // wp_enqueue_script('foundation', get_template_directory_uri() . '/assets/js/common/foundation/foundation.min.js', array('jquery'), false, true);
        wp_enqueue_script('bootstrap', get_template_directory_uri() . '/assets/js/common/bootstrap/bootstrap.bundle.min.js', false, false, true);

        // Common scripts
        // ...

        // Custom scripts
        wp_enqueue_script('project-short-name-js', get_template_directory_uri() . '/assets/js/project.min.js', false, false, true);
        // ...
    }
}
add_action('wp_footer', 'load_assets_in_footer');


