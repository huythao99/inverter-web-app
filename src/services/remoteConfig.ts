import { getApp } from 'firebase/app';
import {
  getRemoteConfig,
  fetchAndActivate,
  getValue,
  RemoteConfig,
} from 'firebase/remote-config';

export interface SupportConfig {
  hardwareSupportName: string;
  hardwareSupportPhone: string;
  softwareSupportName: string;
  softwareSupportPhone: string;
  messengerGroupLink: string;
  warrantyAddress: string;
  warrantyAddressLink: string;
}

let rc: RemoteConfig | null = null;

function getRC(): RemoteConfig {
  if (!rc) {
    rc = getRemoteConfig(getApp());
    rc.settings.minimumFetchIntervalMillis = 5 * 60 * 1000; // 5 minutes
    rc.defaultConfig = {
      hardware_support_name: '',
      hardware_support_phone: '',
      software_support_name: '',
      software_support_phone: '',
      messenger_group_link: '',
      warranty_address: '',
      warranty_address_link: '',
    };
  }
  return rc;
}

export async function fetchSupportConfig(): Promise<SupportConfig> {
  const remoteConfig = getRC();
  await fetchAndActivate(remoteConfig);
  return {
    hardwareSupportName: getValue(remoteConfig, 'hardware_support_name').asString(),
    hardwareSupportPhone: getValue(remoteConfig, 'hardware_support_phone').asString(),
    softwareSupportName: getValue(remoteConfig, 'software_support_name').asString(),
    softwareSupportPhone: getValue(remoteConfig, 'software_support_phone').asString(),
    messengerGroupLink: getValue(remoteConfig, 'messenger_group_link').asString(),
    warrantyAddress: getValue(remoteConfig, 'warranty_address').asString(),
    warrantyAddressLink: getValue(remoteConfig, 'warranty_address_link').asString(),
  };
}
