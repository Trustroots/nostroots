#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "xcodeproj"

ROOT = File.expand_path("..", __dir__)
PROJECT_PATH = File.join(ROOT, "NostrootsNative.xcodeproj")
IOS_VERSION = "17.0"
USE_NOSTR_SDK_PACKAGE = ENV.fetch("NR_USE_NOSTR_SDK_PACKAGE", "1") != "0"

def relative(path)
  path.sub("#{ROOT}/", "")
end

def relative_to(path, base_dir)
  path.sub("#{base_dir}/", "")
end

def configure_target(target, bundle_id:, info_plist:, product_name:)
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["PRODUCT_NAME"] = product_name
    settings["PRODUCT_BUNDLE_IDENTIFIER"] = bundle_id
    settings["INFOPLIST_FILE"] = info_plist
    settings["SWIFT_VERSION"] = "5.0"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
    settings["TARGETED_DEVICE_FAMILY"] = "1,2"
    settings["CODE_SIGNING_ALLOWED"] = "NO"
    settings["CODE_SIGNING_REQUIRED"] = "NO"
    settings["CODE_SIGN_IDENTITY"] = ""
    settings["ENABLE_USER_SCRIPT_SANDBOXING"] = "YES"
    settings["GENERATE_INFOPLIST_FILE"] = "NO"
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
  package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
  package.repositoryURL = "https://github.com/nostr-sdk/nostr-sdk-ios.git"
  package.requirement = {
    "kind" => "revision",
    "revision" => "e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f"
  }
  project.root_object.package_references << package

  targets.each do |target|
    product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    product.package = package
    product.product_name = "NostrSDK"
    target.package_product_dependencies << product

    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = product
    target.frameworks_build_phase.files << build_file
  end
end

FileUtils.rm_rf(PROJECT_PATH)
project = Xcodeproj::Project.new(PROJECT_PATH)

project.build_configurations.each do |config|
  config.build_settings["SWIFT_VERSION"] = "5.0"
  config.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
end

main_group = project.main_group
shared_group = main_group.new_group("SharedCore", "SharedCore")
nostrail_group = main_group.new_group("NostrailApp", "NostrailApp")
swiftroots_group = main_group.new_group("SwiftrootsApp", "SwiftrootsApp")
tests_group = main_group.new_group("NostrootsNativeTests", "NostrootsNativeTests")

nostrail_target = project.new_target(:application, "Nostrail", :ios, IOS_VERSION)
swiftroots_target = project.new_target(:application, "Swiftroots", :ios, IOS_VERSION)
tests_target = project.new_target(:unit_test_bundle, "NostrootsNativeTests", :ios, IOS_VERSION)

configure_target(
  nostrail_target,
  bundle_id: "org.trustroots.nostrail",
  info_plist: "NostrailApp/Info.plist",
  product_name: "Nostrail"
)
configure_target(
  swiftroots_target,
  bundle_id: "org.trustroots.swiftroots",
  info_plist: "SwiftrootsApp/Info.plist",
  product_name: "Swiftroots"
)
configure_test_target(tests_target)

tests_target.add_dependency(nostrail_target)
tests_target.add_dependency(swiftroots_target)
add_nostr_sdk_package(project, [nostrail_target, swiftroots_target, tests_target]) if USE_NOSTR_SDK_PACKAGE

shared_sources = Dir.glob(File.join(ROOT, "SharedCore/**/*.swift")).sort
nostrail_sources = Dir.glob(File.join(ROOT, "NostrailApp/**/*.swift")).sort
swiftroots_sources = Dir.glob(File.join(ROOT, "SwiftrootsApp/**/*.swift")).sort
test_sources = Dir.glob(File.join(ROOT, "NostrootsNativeTests/**/*.swift")).sort

shared_refs = shared_sources.map { |path| shared_group.new_file(relative_to(path, File.join(ROOT, "SharedCore"))) }
nostrail_refs = nostrail_sources.map { |path| nostrail_group.new_file(relative_to(path, File.join(ROOT, "NostrailApp"))) }
swiftroots_refs = swiftroots_sources.map { |path| swiftroots_group.new_file(relative_to(path, File.join(ROOT, "SwiftrootsApp"))) }
test_refs = test_sources.map { |path| tests_group.new_file(relative_to(path, File.join(ROOT, "NostrootsNativeTests"))) }

nostrail_target.add_file_references(shared_refs + nostrail_refs)
swiftroots_target.add_file_references(shared_refs + swiftroots_refs)
tests_target.add_file_references(shared_refs + test_refs)

project.save

nostrail_scheme = Xcodeproj::XCScheme.new
nostrail_scheme.add_build_target(nostrail_target)
nostrail_scheme.set_launch_target(nostrail_target)
nostrail_scheme.save_as(PROJECT_PATH, "Nostrail", true)

swiftroots_scheme = Xcodeproj::XCScheme.new
swiftroots_scheme.add_build_target(swiftroots_target)
swiftroots_scheme.set_launch_target(swiftroots_target)
swiftroots_scheme.save_as(PROJECT_PATH, "Swiftroots", true)

tests_scheme = Xcodeproj::XCScheme.new
tests_scheme.add_build_target(nostrail_target)
tests_scheme.add_build_target(swiftroots_target)
tests_scheme.add_build_target(tests_target)
tests_scheme.add_test_target(tests_target)
tests_scheme.set_launch_target(nostrail_target)
tests_scheme.save_as(PROJECT_PATH, "NostrootsNativeTests", true)

puts "Generated #{PROJECT_PATH}"
puts "NostrSDK Swift package: #{USE_NOSTR_SDK_PACKAGE ? "enabled" : "disabled"}"
