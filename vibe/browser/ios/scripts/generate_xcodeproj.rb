#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "xcodeproj"

ROOT = File.expand_path("..", __dir__)
PROJECT_PATH = File.join(ROOT, "NostrootsBrowser.xcodeproj")
IOS_VERSION = "17.0"
USE_NOSTR_SDK_PACKAGE = ENV.fetch("NR_USE_NOSTR_SDK_PACKAGE", "1") != "0"
LOCAL_NOSTR_SDK_PATH = ENV["NR_NOSTR_SDK_LOCAL_PATH"]

def relative_to(path, base_dir)
  path.sub("#{base_dir}/", "")
end

def configure_app_target(target)
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["PRODUCT_NAME"] = "Nostroots iOS"
    settings["PRODUCT_MODULE_NAME"] = "NostrootsBrowser"
    settings["PRODUCT_BUNDLE_IDENTIFIER"] = "org.trustroots.nostroots.browser"
    settings["INFOPLIST_FILE"] = "NostrootsBrowserApp/Info.plist"
    settings["SWIFT_VERSION"] = "5.0"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
    settings["TARGETED_DEVICE_FAMILY"] = "1,2"
    settings["CODE_SIGNING_ALLOWED"] = "NO"
    settings["CODE_SIGNING_REQUIRED"] = "NO"
    settings["CODE_SIGN_IDENTITY"] = ""
    settings["CODE_SIGN_ENTITLEMENTS"] = "NostrootsBrowserApp/NostrootsBrowser.entitlements"
    settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "NO"
    settings["GENERATE_INFOPLIST_FILE"] = "NO"
    settings["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
  end
end

def configure_test_target(target)
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["SWIFT_VERSION"] = "5.0"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
    settings["TARGETED_DEVICE_FAMILY"] = "1,2"
    settings["CODE_SIGNING_ALLOWED"] = "NO"
    settings["CODE_SIGNING_REQUIRED"] = "NO"
    settings["CODE_SIGN_IDENTITY"] = ""
    settings["GENERATE_INFOPLIST_FILE"] = "YES"
  end
end

def add_nostr_sdk_package(project, targets)
  using_local_package = LOCAL_NOSTR_SDK_PATH && !LOCAL_NOSTR_SDK_PATH.empty?
  package =
    if using_local_package
      local_package = project.new(Xcodeproj::Project::Object::XCLocalSwiftPackageReference)
      local_package.relative_path = LOCAL_NOSTR_SDK_PATH
      local_package
    else
      remote_package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
      remote_package.repositoryURL = "https://github.com/nostr-sdk/nostr-sdk-ios.git"
      remote_package.requirement = {
        "kind" => "revision",
        "revision" => "e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f"
      }
      remote_package
    end
  project.root_object.package_references << package

  targets.each do |target|
    product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    product.package = package unless using_local_package
    product.product_name = "NostrSDK"
    target.package_product_dependencies << product

    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = product
    target.frameworks_build_phase.files << build_file
  end
end

def add_build_time_phase(target)
  phase = target.new_shell_script_build_phase("Stamp build time")
  phase.shell_script = <<~SCRIPT
    set -euo pipefail
    build_time="$(date '+%Y-%m-%d %H:%M')"
    plist_path="${TARGET_BUILD_DIR}/${INFOPLIST_PATH}"
    /usr/libexec/PlistBuddy -c "Set :NRBuildTime ${build_time}" "${plist_path}" 2>/dev/null || \\
      /usr/libexec/PlistBuddy -c "Add :NRBuildTime string ${build_time}" "${plist_path}"
  SCRIPT
  phase.always_out_of_date = "1"
  phase.show_env_vars_in_log = "0"
end

FileUtils.rm_rf(PROJECT_PATH)
project = Xcodeproj::Project.new(PROJECT_PATH)

project.build_configurations.each do |config|
  config.build_settings["SWIFT_VERSION"] = "5.0"
  config.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
end

main_group = project.main_group
shared_group = main_group.new_group("SharedCore", "SharedCore")
app_group = main_group.new_group("NostrootsBrowserApp", "NostrootsBrowserApp")
tests_group = main_group.new_group("NostrootsBrowserTests", "NostrootsBrowserTests")

app_target = project.new_target(:application, "NostrootsBrowser", :ios, IOS_VERSION)
tests_target = project.new_target(:unit_test_bundle, "NostrootsBrowserTests", :ios, IOS_VERSION)

configure_app_target(app_target)
configure_test_target(tests_target)
tests_target.add_dependency(app_target)
add_nostr_sdk_package(project, [app_target, tests_target]) if USE_NOSTR_SDK_PACKAGE
add_build_time_phase(app_target)

shared_sources = Dir.glob(File.join(ROOT, "SharedCore/**/*.swift")).sort
app_sources = Dir.glob(File.join(ROOT, "NostrootsBrowserApp/**/*.swift")).sort
test_sources = Dir.glob(File.join(ROOT, "NostrootsBrowserTests/**/*.swift")).sort

shared_refs = shared_sources.map { |path| shared_group.new_file(relative_to(path, File.join(ROOT, "SharedCore"))) }
app_refs = app_sources.map { |path| app_group.new_file(relative_to(path, File.join(ROOT, "NostrootsBrowserApp"))) }
test_refs = test_sources.map { |path| tests_group.new_file(relative_to(path, File.join(ROOT, "NostrootsBrowserTests"))) }
assets_ref = app_group.new_file("Assets.xcassets")

app_target.add_file_references(shared_refs + app_refs)
app_target.resources_build_phase.add_file_reference(assets_ref)
tests_target.add_file_references(shared_refs + test_refs)

project.save

app_scheme = Xcodeproj::XCScheme.new
app_scheme.add_build_target(app_target)
app_scheme.set_launch_target(app_target)
app_scheme.save_as(PROJECT_PATH, "NostrootsBrowser", true)

tests_scheme = Xcodeproj::XCScheme.new
tests_scheme.add_build_target(app_target)
tests_scheme.add_build_target(tests_target)
tests_scheme.add_test_target(tests_target)
tests_scheme.set_launch_target(app_target)
tests_scheme.save_as(PROJECT_PATH, "NostrootsBrowserTests", true)

puts "Generated #{PROJECT_PATH}"
puts "NostrSDK Swift package: #{USE_NOSTR_SDK_PACKAGE ? "enabled" : "disabled"}"
puts "NostrSDK local path: #{LOCAL_NOSTR_SDK_PATH}" if USE_NOSTR_SDK_PACKAGE && LOCAL_NOSTR_SDK_PATH && !LOCAL_NOSTR_SDK_PATH.empty?
